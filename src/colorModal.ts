import { type App, Modal, Setting } from 'obsidian';
import type { ColorState } from './model';

export type ColorChoice =
	| { kind: 'state'; state: ColorState }
	| { kind: 'custom'; color: string }
	| { kind: 'clear' };

/**
 * The picker behind "Color note" / "Color folder".
 *
 * States come first because they are the answer most of the time; the custom
 * colour sits below as the escape hatch. A folder gets no states at all — it
 * has no front matter to write one into — so the list is simply empty and the
 * dialog is a colour picker.
 */
export class ColorModal extends Modal {
	private readonly states: ColorState[];
	private readonly current: string | null;
	private readonly onChoose: (choice: ColorChoice) => void;
	private customColor: string;

	constructor(
		app: App,
		options: {
			title: string;
			states: ColorState[];
			/** The state value or colour already in force, to mark it as current. */
			current: string | null;
			initialCustom: string;
			onChoose: (choice: ColorChoice) => void;
		},
	) {
		super(app);
		this.states = options.states;
		this.current = options.current;
		this.customColor = options.initialCustom;
		this.onChoose = options.onChoose;
		this.setTitle(options.title);
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.addClass('color-note-modal');

		for (const state of this.states) {
			const row = new Setting(contentEl).setName(state.label).setDesc(state.description);

			// The swatch is the point of the dialog: the name of a state means
			// nothing until you see which colour it puts in the tree.
			const swatch = row.nameEl.createSpan({ cls: 'color-note-swatch' });
			swatch.style.backgroundColor = state.color;
			row.nameEl.prepend(swatch);

			if (state.value === this.current) {
				row.setClass('color-note-current');
				row.addExtraButton((button) => button.setIcon('check').setDisabled(true));
			}

			row.addButton((button) =>
				button.setButtonText('Apply').onClick(() => {
					this.onChoose({ kind: 'state', state });
					this.close();
				}),
			);
		}

		new Setting(contentEl)
			.setName('Custom colour')
			.setDesc('A one-off colour for this item, independent of any state.')
			.addColorPicker((picker) =>
				picker.setValue(this.customColor).onChange((value) => {
					this.customColor = value;
				}),
			)
			.addButton((button) =>
				button
					.setButtonText('Apply')
					.setCta()
					.onClick(() => {
						this.onChoose({ kind: 'custom', color: this.customColor });
						this.close();
					}),
			);

		// setWarning is deprecated in favour of setDestructive, which needs
		// Obsidian 1.13. Swap it when minAppVersion moves up — until then this
		// is the one that works for everybody.
		new Setting(contentEl).addButton((button) =>
			button
				.setButtonText('Remove colour')
				.setWarning()
				.onClick(() => {
					this.onChoose({ kind: 'clear' });
					this.close();
				}),
		);
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
