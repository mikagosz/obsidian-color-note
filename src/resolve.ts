import type { ColorNoteSettings, ColorState } from './model';

/**
 * Works out what colour each path should be. Pure: no DOM, no Obsidian, so the
 * rules can be tested on their own.
 *
 * The plugin deliberately does not generate a stylesheet. Obsidian's plugin
 * guidelines forbid creating `style` elements, and the rules that consume these
 * values live in `styles.css` — this module only decides the values.
 */

/** `#abc` or `#aabbcc`, nothing else. */
const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export function isValidColor(color: string): boolean {
	return HEX.test(color.trim());
}

/** The two colours a title takes, one per theme. */
export interface ResolvedColor {
	dark: string;
	light: string;
}

/**
 * A single colour that reads well on both themes is a legitimate choice, so the
 * light variant is optional and falls back to the main one.
 */
function resolve(source: { color: string; colorLight: string }): ResolvedColor | null {
	const dark = source.color.trim();
	if (!isValidColor(dark)) return null;

	const light = source.colorLight.trim();
	return { dark, light: isValidColor(light) ? light : dark };
}

export interface ResolveInput {
	/** Path → state value, for notes whose front matter carries a state. */
	statusByPath: Map<string, string>;
	settings: ColorNoteSettings;
}

/**
 * Builds the path → colour map the file explorer is painted from.
 *
 * A hand-picked colour beats the note's state: the state is a rule of thumb,
 * the custom colour was chosen for this one item on purpose.
 */
export function resolveColors(input: ResolveInput): Map<string, ResolvedColor> {
	const statesByValue = new Map<string, ColorState>(
		input.settings.states.map((state) => [state.value, state]),
	);

	const colors = new Map<string, ResolvedColor>();

	for (const [path, statusValue] of input.statusByPath) {
		const state = statesByValue.get(statusValue);
		if (!state) continue;
		const resolved = resolve(state);
		if (resolved) colors.set(path, resolved);
	}

	for (const [path, pathColor] of Object.entries(input.settings.pathColors)) {
		const resolved = resolve(pathColor);
		if (resolved) colors.set(path, resolved);
	}

	return colors;
}
