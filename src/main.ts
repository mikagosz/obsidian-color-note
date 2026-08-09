import { Plugin, type TAbstractFile, TFile, TFolder } from 'obsidian';
import { type ColorChoice, ColorModal } from './colorModal';
import { type ColorNoteSettings, DEFAULT_SETTINGS } from './model';
import { ExplorerPainter } from './painter';
import { resolveColors } from './resolve';
import { ColorNoteSettingTab } from './settings';

export default class ColorNotePlugin extends Plugin {
	settings: ColorNoteSettings = DEFAULT_SETTINGS;

	private readonly painter = new ExplorerPainter();
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
		this.registerEvent(this.app.metadataCache.on('changed', () => this.scheduleRepaint()));
		this.registerEvent(
			this.app.vault.on('rename', (file, oldPath) => this.onRename(file, oldPath)),
		);
		this.registerEvent(this.app.vault.on('delete', (file) => this.onDelete(file)));

		// The first paint waits for the cache: on a cold start the front matter
		// of most notes is not parsed yet, and painting now would paint nothing.
		this.app.workspace.onLayoutReady(() => {
			this.painter.start();
			this.repaint();
		});
	}

	onunload(): void {
		this.painter.stop();
		if (this.repaintTimer !== null) window.clearTimeout(this.repaintTimer);
	}

	async loadSettings(): Promise<void> {
		const stored = (await this.loadData()) as Partial<ColorNoteSettings> | null;
		this.settings = { ...DEFAULT_SETTINGS, ...(stored ?? {}) };
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
		this.repaint();
	}

	/** Re-reads the vault's states and hands the resulting colours to the painter. */
	repaint(): void {
		const statusByPath = new Map<string, string>();
		for (const file of this.app.vault.getMarkdownFiles()) {
			const value = this.statusOf(file);
			if (value !== null) statusByPath.set(file.path, value);
		}

		this.painter.setColors(resolveColors({ statusByPath, settings: this.settings }));
	}

	/** The note's state, or `null` when it has none. */
	private statusOf(file: TFile): string | null {
		const frontmatter: Record<string, unknown> | undefined =
			this.app.metadataCache.getFileCache(file)?.frontmatter;
		const value = frontmatter?.[this.settings.statusField];
		return typeof value === 'string' && value.length > 0 ? value : null;
	}

	/**
	 * Editing a note fires `changed` for every keystroke burst; rebuilding the
	 * whole sheet each time would walk every file in the vault for nothing.
	 */
	private scheduleRepaint(): void {
		if (this.repaintTimer !== null) window.clearTimeout(this.repaintTimer);
		this.repaintTimer = window.setTimeout(() => {
			this.repaintTimer = null;
			this.repaint();
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

	/** A path is the key here, so a rename has to carry the colour with it. */
	private onRename(file: TAbstractFile, oldPath: string): void {
		const color = this.settings.pathColors[oldPath];
		if (color) {
			delete this.settings.pathColors[oldPath];
			this.settings.pathColors[file.path] = color;
			void this.saveSettings();
			return;
		}
		this.scheduleRepaint();
	}

	/** Without this, deleted notes would leave their colours in `data.json` forever. */
	private onDelete(file: TAbstractFile): void {
		if (this.settings.pathColors[file.path]) {
			delete this.settings.pathColors[file.path];
			void this.saveSettings();
			return;
		}
		this.scheduleRepaint();
	}
}
