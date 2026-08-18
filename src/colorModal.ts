import { type App, type ColorComponent, Modal, Setting } from 'obsidian';
import type { ColorState } from './model';
import { type Crayon, PALETTE } from './palette';
import { paintSwatch } from './swatch';

export type ColorChoice =
	| { kind: 'state'; state: ColorState }
	| { kind: 'custom'; color: string; colorLight: string }
	| { kind: 'clear' };

/** Chromium's own colour sampler. Not in the DOM typings yet, so declared here. */
interface EyeDropperApi {
	open(): Promise<{ sRGBHex: string }>;
}

function eyeDropper(): EyeDropperApi | null {
	const ctor = (window as { EyeDropper?: new () => EyeDropperApi }).EyeDropper;
	return ctor ? new ctor() : null;
}

/**
 * The picker behind "Color note" / "Color folder".
 *
 * Three ways in, in the order they are reached for: the states, which carry a
 * meaning as well as a colour; the palette, for "just make it teal"; and the
 * colour picker, for the one colour nothing else covers.
 *
 * A folder gets the states too. It has no front matter to write one into, so
 * the state's colour is pinned to its path instead — from the reader's side the
 * tree looks the same either way, and having half the dialog disappear on a
 * folder made the states look like a feature that broke.
 */
export class ColorModal extends Modal {
	private readonly states: ColorState[];
	private readonly current: string | null;
	private readonly recent: string[];
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
			/** Colours already used elsewhere in the vault, offered as one more row. */
			recent: string[];
			onChoose: (choice: ColorChoice) => void;
		},
	) {
		super(app);
		this.states = options.states;
		this.current = options.current;
		this.customColor = options.initialCustom;
		this.recent = options.recent;
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
			paintSwatch(swatch, state.color);
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

		this.palette(contentEl);
		this.custom(contentEl);

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

	/**
	 * The grid of squares, and under it whatever colours the vault is already
	 * using. One click applies and closes — a palette that needed a second click
	 * on "Apply" would be slower than the picker it replaces.
	 */
	private palette(parent: HTMLElement): void {
		new Setting(parent)
			.setName('Palette')
			.setDesc('One click paints. Each colour carries a shade for either theme.')
			.setHeading();

		const grid = parent.createDiv({ cls: 'color-note-palette' });
		for (const crayon of PALETTE) {
			this.square(grid, crayon.dark, `${crayon.name} · ${crayon.dark}`, () => this.pick(crayon));
		}

		if (this.recent.length === 0) return;
		new Setting(parent).setName('Used elsewhere in this vault').setHeading();
		const used = parent.createDiv({ cls: 'color-note-palette' });
		for (const color of this.recent) {
			this.square(used, color, color, () => this.pick({ name: color, dark: color, light: color }));
		}
	}

	/** One square: a real button, so the keyboard and screen readers get it too. */
	private square(parent: HTMLElement, color: string, label: string, onClick: () => void): void {
		const button = parent.createEl('button', { cls: 'color-note-chip' });
		button.setAttr('type', 'button');
		button.setAttr('aria-label', label);
		button.setAttr('title', label);
		paintSwatch(button, color);
		if (color.trim().toLowerCase() === (this.current ?? '').trim().toLowerCase()) {
			button.addClass('is-current');
		}
		button.addEventListener('click', onClick);
	}

	private pick(crayon: Crayon): void {
		this.onChoose({ kind: 'custom', color: crayon.dark, colorLight: crayon.light });
		this.close();
	}

	/**
	 * The escape hatch: any colour at all.
	 *
	 * The eyedropper is ours rather than the one inside the operating system's
	 * colour panel — on macOS that one opens, magnifies, and hands back black
	 * whatever it was pointed at. Chromium's sampler works, so the button is
	 * shown only where it exists and is simply absent elsewhere.
	 */
	private custom(parent: HTMLElement): void {
		let picker: ColorComponent | null = null;

		const row = new Setting(parent)
			.setName('Custom colour')
			.setDesc('A one-off colour for this item, used in both themes.')
			.addColorPicker((component) => {
				picker = component;
				component.setValue(this.customColor).onChange((value) => {
					this.customColor = value;
				});
			});

		const dropper = eyeDropper();
		if (dropper) {
			row.addExtraButton((button) =>
				button
					.setIcon('pipette')
					.setTooltip('Pick a colour from anywhere on the screen')
					.onClick(() => {
						void dropper.open().then(
							(result) => {
								this.customColor = result.sRGBHex;
								picker?.setValue(result.sRGBHex);
							},
							// Closing the sampler with Escape rejects; that is a
							// cancel, not a failure, and has nothing to report.
							() => undefined,
						);
					}),
			);
		}

		row.addButton((button) =>
			button
				.setButtonText('Apply')
				.setCta()
				.onClick(() => {
					this.onChoose({
						kind: 'custom',
						color: this.customColor,
						colorLight: this.customColor,
					});
					this.close();
				}),
		);
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
