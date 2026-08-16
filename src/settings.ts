import { type App, debounce, Modal, PluginSettingTab, Setting } from 'obsidian';
import type ColorNotePlugin from './main';
import type { ColorState } from './model';
import { paintSwatch } from './swatch';

/**
 * The settings tab exists so states can be invented without touching code: a
 * colour, a name, and a sentence saying what it stands for. Three months later
 * that sentence is the only thing that still explains why a note is orange.
 */
export class ColorNoteSettingTab extends PluginSettingTab {
	private readonly plugin: ColorNotePlugin;

	constructor(app: App, plugin: ColorNotePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		// Saving on every keystroke also repainted the whole vault on every
		// keystroke, and wrote half-typed field names to disk on the way.
		const saveField = debounce(
			(value: string) => {
				this.plugin.settings.statusField = value.trim() || 'status';
				void this.plugin.saveSettings();
			},
			500,
			true,
		);

		new Setting(containerEl)
			.setName('Front matter field')
			.setDesc(
				'The field a state is written to. Change this only if your vault uses another name — notes already carrying a state keep it under the old field, so the two can drift apart.',
			)
			.addText((text) => text.setValue(this.plugin.settings.statusField).onChange(saveField));

		new Setting(containerEl).setName('States').setHeading();

		new Setting(containerEl)
			.setDesc(
				'Each state writes its value to the front matter field above and paints the title in the file explorer. Add your own whenever you need a colour that means something new.',
			)
			.addButton((button) =>
				button
					.setButtonText('Add state')
					.setCta()
					.onClick(() => this.editState(null)),
			);

		this.plugin.settings.states.forEach((state, index) => {
			const row = new Setting(containerEl)
				.setName(state.label)
				.setDesc(`${state.value} — ${state.description}`);

			const swatch = row.nameEl.createSpan({ cls: 'color-note-swatch' });
			paintSwatch(swatch, state.color);
			row.nameEl.prepend(swatch);

			row.addExtraButton((button) =>
				button
					.setIcon('pencil')
					.setTooltip('Edit')
					.onClick(() => this.editState(index)),
			);
			row.addExtraButton((button) =>
				button
					.setIcon('trash')
					.setTooltip('Delete')
					.onClick(async () => {
						this.plugin.settings.states.splice(index, 1);
						await this.plugin.saveSettings();
						this.display();
					}),
			);
		});

		const coloured = Object.keys(this.plugin.settings.pathColors);
		new Setting(containerEl).setName('Custom colours').setHeading();
		new Setting(containerEl)
			.setDesc(
				coloured.length === 0
					? 'Nothing has a one-off colour yet.'
					: `${coloured.length} item(s) carry a colour picked by hand.`,
			)
			.addButton((button) =>
				button
					.setButtonText('Clear all')
					.setWarning()
					.setDisabled(coloured.length === 0)
					.onClick(async () => {
						this.plugin.settings.pathColors = {};
						await this.plugin.saveSettings();
						this.display();
					}),
			);
	}

	/** `null` adds a new state; an index edits the one already there. */
	private editState(index: number | null): void {
		const existing = index === null ? null : (this.plugin.settings.states[index] ?? null);

		new StateEditModal(this.app, existing, (state) => {
			if (index === null) this.plugin.settings.states.push(state);
			else this.plugin.settings.states[index] = state;
			void this.plugin.saveSettings().then(() => {
				this.display();
			});
		}).open();
	}
}

const BLANK: ColorState = {
	value: '',
	label: '',
	color: '#4c9a63',
	colorLight: '',
	description: '',
};

class StateEditModal extends Modal {
	private draft: ColorState;
	private readonly onSave: (state: ColorState) => void;

	constructor(app: App, existing: ColorState | null, onSave: (state: ColorState) => void) {
		super(app);
		this.draft = { ...(existing ?? BLANK) };
		this.onSave = onSave;
		this.setTitle(existing ? 'Edit state' : 'Add state');
	}

	onOpen(): void {
		const { contentEl } = this;

		new Setting(contentEl)
			.setName('Name')
			.setDesc('Shown in the right-click menu.')
			.addText((text) =>
				text.setValue(this.draft.label).onChange((value) => {
					this.draft.label = value;
				}),
			);

		new Setting(contentEl)
			.setName('Value')
			.setDesc('Written to the front matter, e.g. "on-hold". Keep it stable — notes store it.')
			.addText((text) =>
				text.setValue(this.draft.value).onChange((value) => {
					this.draft.value = value.trim();
				}),
			);

		new Setting(contentEl)
			.setName('Meaning')
			.setDesc('One sentence. This is what you will read months from now.')
			.addTextArea((text) =>
				text.setValue(this.draft.description).onChange((value) => {
					this.draft.description = value;
				}),
			);

		new Setting(contentEl).setName('Colour (dark theme)').addColorPicker((picker) =>
			picker.setValue(this.draft.color).onChange((value) => {
				this.draft.color = value;
			}),
		);

		new Setting(contentEl)
			.setName('Colour (light theme)')
			.setDesc('Optional. A colour readable on both themes can be left out.')
			.addColorPicker((picker) =>
				picker.setValue(this.draft.colorLight || this.draft.color).onChange((value) => {
					this.draft.colorLight = value;
				}),
			);

		new Setting(contentEl).addButton((button) =>
			button
				.setButtonText('Save')
				.setCta()
				.onClick(() => {
					// A state without a value would write an empty field into
					// every note it touched; without a label it would be an
					// unnamed row in the menu.
					if (!this.draft.value || !this.draft.label) return;
					this.onSave(this.draft);
					this.close();
				}),
		);
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
