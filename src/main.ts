import { Plugin, type TAbstractFile, TFile, TFolder } from 'obsidian';
import { type ColorChoice, ColorModal } from './colorModal';
import { type ColorNoteSettings, withDefaults } from './model';
import { ExplorerPainter } from './painter';
import { keysUnder, remapPaths } from './paths';
import { resolveColors } from './resolve';
import { ColorNoteSettingTab } from './settings';

export default class ColorNotePlugin extends Plugin {
	// Cloned, not the module constant: nothing may edit the defaults in place, not
	// even in the moment before `onload` replaces this.
	settings: ColorNoteSettings = withDefaults(null);

	private readonly painter = new ExplorerPainter();
	/** Path → state, kept up to date one note at a time. See `noteChanged`. */
	private readonly statusByPath = new Map<string, string>();
	private repaintTimer: number | null = null;

	async onload(): Promise<void> {
		await this.loadSettings();

		this.addSettingTab(new ColorNoteSettingTab(this.app, this));

		this.registerEvent(
			this.app.workspace.on('file-menu', (menu, file) => {
				const isFolder = file instanceof TFolder;
				menu.addItem((item) =>
					item
						.setTitle(isFolder ? 'Color folder' : 'Color note')
						.setIcon('palette')
						.onClick(() => this.openPicker(file)),
				);
			}),
		);

		// Front matter edited by hand (or by an agent) has to reach the tree too —
		// the plugin is one way of setting a state, not the only one.
		this.registerEvent(this.app.metadataCache.on('changed', (file) => this.noteChanged(file)));
		this.registerEvent(
			this.app.vault.on('rename', (file, oldPath) => this.onRename(file, oldPath)),
		);
		this.registerEvent(this.app.vault.on('delete', (file) => this.onDelete(file)));

		// The explorer can be closed and reopened, which replaces the element the
		// painter watches. Re-pointing it is a no-op when nothing moved.
		this.registerEvent(
			this.app.workspace.on('layout-change', () => this.painter.watch(this.explorerEl())),
		);

		// The first paint waits for the cache: on a cold start the front matter
		// of most notes is not parsed yet, and painting now would paint nothing.
		this.app.workspace.onLayoutReady(() => {
			this.painter.watch(this.explorerEl());
			this.repaint();
		});
	}

	/** The file explorer's own container, or `null` when the pane is closed. */
	private explorerEl(): HTMLElement | null {
		return this.app.workspace.getLeavesOfType('file-explorer')[0]?.view.containerEl ?? null;
	}

	onunload(): void {
		this.painter.stop();
		if (this.repaintTimer !== null) window.clearTimeout(this.repaintTimer);
	}

	async loadSettings(): Promise<void> {
		const stored = (await this.loadData()) as Partial<ColorNoteSettings> | null;
		this.settings = withDefaults(stored);
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
		this.repaint();
	}

	/**
	 * Full sweep of the vault, then paint. Only two things need it: the cold start,
	 * and a settings change — which can alter the front matter field itself, so
	 * every note has to be looked at again. Ordinary edits go through `noteChanged`.
	 */
	repaint(): void {
		this.statusByPath.clear();
		for (const file of this.app.vault.getMarkdownFiles()) {
			const value = this.statusOf(file);
			if (value !== null) this.statusByPath.set(file.path, value);
		}

		this.applyColors();
	}

	/** Hands the current index to the painter. Cheap: no vault access at all. */
	private applyColors(): void {
		this.painter.setColors(
			resolveColors({ statusByPath: this.statusByPath, settings: this.settings }),
		);
	}

	/**
	 * One note changed, so exactly one entry changes. Walking the whole vault here
	 * cost the same on a note nobody touched as on the one that was edited, and it
	 * ran on every burst of typing.
	 */
	private noteChanged(file: TFile): void {
		const value = this.statusOf(file);
		if (value === null) this.statusByPath.delete(file.path);
		else this.statusByPath.set(file.path, value);
		this.scheduleRepaint();
	}

	/** The note's state, or `null` when it has none. */
	private statusOf(file: TFile): string | null {
		const frontmatter: Record<string, unknown> | undefined =
			this.app.metadataCache.getFileCache(file)?.frontmatter;
		const value = frontmatter?.[this.settings.statusField];
		return typeof value === 'string' && value.length > 0 ? value : null;
	}

	/**
	 * Editing a note fires `changed` for every keystroke burst, so the paint is
	 * collapsed into one pass per burst. The index itself is already up to date by
	 * then — only handing it to the painter waits.
	 */
	private scheduleRepaint(): void {
		if (this.repaintTimer !== null) window.clearTimeout(this.repaintTimer);
		this.repaintTimer = window.setTimeout(() => {
			this.repaintTimer = null;
			this.applyColors();
		}, 300);
	}

	private openPicker(file: TAbstractFile): void {
		const isFolder = file instanceof TFolder;
		const pathColor = this.settings.pathColors[file.path];

		new ColorModal(this.app, {
			title: `${isFolder ? 'Color folder' : 'Color note'}: ${file.name}`,
			// A folder has no front matter, so a state cannot be written into it.
			states: isFolder ? [] : this.settings.states,
			current: file instanceof TFile ? this.statusOf(file) : null,
			initialCustom: pathColor?.color ?? '#4c9a63',
			onChoose: (choice) => void this.apply(file, choice),
		}).open();
	}

	private async apply(file: TAbstractFile, choice: ColorChoice): Promise<void> {
		switch (choice.kind) {
			case 'state':
				// A hand-picked colour would otherwise keep overriding the state
				// the user just chose, and the menu would look broken.
				delete this.settings.pathColors[file.path];
				await this.writeStatus(file, choice.state.value);
				break;

			case 'custom':
				this.settings.pathColors[file.path] = {
					color: choice.color,
					colorLight: choice.color,
				};
				break;

			case 'clear':
				delete this.settings.pathColors[file.path];
				await this.writeStatus(file, null);
				break;
		}

		await this.saveSettings();
	}

	/** Writes (or removes) the state field, leaving the rest of the front matter alone. */
	private async writeStatus(file: TAbstractFile, value: string | null): Promise<void> {
		if (!(file instanceof TFile) || file.extension !== 'md') return;

		// processFrontMatter creates the block when there is none and rewrites
		// only the one field — safer than touching the note's text ourselves.
		await this.app.fileManager.processFrontMatter(file, (frontmatter: Record<string, unknown>) => {
			if (value === null) delete frontmatter[this.settings.statusField];
			else frontmatter[this.settings.statusField] = value;
		});
	}

	/**
	 * A path is the key here, so a rename has to carry the colour with it —
	 * **including everything inside a renamed folder.** Only the folder arrives in
	 * this event, while every path under it changes at the same moment; moving just
	 * the one key left the notes inside colourless and their entries stranded in
	 * `data.json` for good. The prefix rule itself lives in `paths.ts`, tested.
	 */
	private onRename(file: TAbstractFile, oldPath: string): void {
		let moved = false;
		for (const { from, to } of remapPaths(
			Object.keys(this.settings.pathColors),
			oldPath,
			file.path,
		)) {
			const color = this.settings.pathColors[from];
			if (!color) continue;
			delete this.settings.pathColors[from];
			this.settings.pathColors[to] = color;
			moved = true;
		}

		for (const { from, to } of remapPaths([...this.statusByPath.keys()], oldPath, file.path)) {
			const value = this.statusByPath.get(from);
			this.statusByPath.delete(from);
			if (value !== undefined) this.statusByPath.set(to, value);
		}

		if (moved) {
			void this.saveSettings();
			return;
		}
		this.scheduleRepaint();
	}

	/** Without this, deleted notes would leave their colours in `data.json` forever. */
	private onDelete(file: TAbstractFile): void {
		let dropped = false;
		for (const key of keysUnder(Object.keys(this.settings.pathColors), file.path)) {
			delete this.settings.pathColors[key];
			dropped = true;
		}

		for (const key of keysUnder([...this.statusByPath.keys()], file.path)) {
			this.statusByPath.delete(key);
		}

		if (dropped) {
			void this.saveSettings();
			return;
		}
		this.scheduleRepaint();
	}
}
