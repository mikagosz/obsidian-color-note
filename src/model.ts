/**
 * A colour the user can assign, together with what it means.
 *
 * States are data, not constants: the whole point of the plugin is that a new
 * one can be invented in the settings — a colour, a name and a sentence saying
 * what it stands for — without touching any code or CSS.
 */
export interface ColorState {
	/** Written to the note's `status:` front matter field, e.g. `zrobione`. */
	value: string;
	/** Shown in the right-click menu, e.g. "Done". */
	label: string;
	/** Colour for the dark theme, `#rgb` or `#rrggbb`. */
	color: string;
	/** Colour for the light theme. Falls back to `color` when empty. */
	colorLight: string;
	/** What this state means. Shown in the settings, so a state invented three
	 *  months ago still explains itself. */
	description: string;
}

/** A one-off colour pinned to a single path — the escape hatch from states. */
export interface PathColor {
	color: string;
	colorLight: string;
}

export interface ColorNoteSettings {
	/** The palette offered in the right-click menu, in menu order. */
	states: ColorState[];
	/** Ad-hoc colours by vault path. Folders live here too: a folder has no
	 *  front matter, so a state cannot be written into it. */
	pathColors: Record<string, PathColor>;
	/** Front matter field the states are written to. */
	statusField: string;
}

/**
 * A starting palette, not a fixed one: four states that cover the usual life of
 * a note, meant to be renamed, recoloured or deleted.
 *
 * Each carries the colours of the theme it is meant for. They are picked to stay
 * readable on both a dark and a light background, which matters more here than
 * being vivid — a title is small text, not a badge.
 */
export const DEFAULT_STATES: ColorState[] = [
	{
		value: 'open',
		label: 'Open',
		color: '#ff7b7b',
		colorLight: '#c0392b',
		description: 'Still to do.',
	},
	{
		value: 'done',
		label: 'Done',
		color: '#4c9a63',
		colorLight: '#1e6b34',
		description: 'Finished and still current.',
	},
	{
		value: 'needs-testing',
		label: 'Needs testing',
		color: '#e69a3c',
		colorLight: '#b35c00',
		description: 'Complete, but nobody has tried it yet.',
	},
	{
		value: 'archived',
		label: 'Archived',
		color: '#8a9459',
		colorLight: '#6b7340',
		description: 'Nothing left to take from it — no need to open it.',
	},
];

export const DEFAULT_SETTINGS: ColorNoteSettings = {
	states: DEFAULT_STATES,
	pathColors: {},
	statusField: 'status',
};

/**
 * Stored settings on top of the defaults, with the defaults **cloned**.
 *
 * A plain spread would hand out the module's own `DEFAULT_STATES` array, which
 * the settings tab then edits in place — so deleting a state on a fresh install
 * would quietly rewrite the defaults for the rest of the session.
 *
 * Every field is also **checked for shape**. `data.json` can be edited by hand or
 * come back from a sync conflict, and one entry without `colorLight` used to throw
 * inside the paint on every keystroke, leaving the whole tree uncoloured. A field
 * of the wrong type falls back to its default; an entry that cannot be salvaged is
 * dropped; a missing optional text becomes empty.
 */
export function withDefaults(stored: unknown): ColorNoteSettings {
	const defaults = structuredClone(DEFAULT_SETTINGS);
	if (!isRecord(stored)) return defaults;

	return {
		states: Array.isArray(stored.states) ? stored.states.flatMap(toState) : defaults.states,
		pathColors: isRecord(stored.pathColors) ? toPathColors(stored.pathColors) : defaults.pathColors,
		statusField:
			typeof stored.statusField === 'string' && stored.statusField.trim().length > 0
				? stored.statusField
				: defaults.statusField,
	};
}

/**
 * What a state still lacks before it can be saved, in words for a notice.
 *
 * A state without a value would write an empty field into every note it touched;
 * without a name it would be an unnamed row in the menu. Blank space counts as
 * nothing — `" "` is not a name.
 */
export function missingStateFields(state: Pick<ColorState, 'label' | 'value'>): string[] {
	const missing: string[] = [];
	if (state.label.trim().length === 0) missing.push('a name');
	if (state.value.trim().length === 0) missing.push('a value');
	return missing;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown): string {
	return typeof value === 'string' ? value : '';
}

/** A state needs a value to write and a colour to paint; the rest can be blank. */
function toState(raw: unknown): ColorState[] {
	if (!isRecord(raw)) return [];
	const value = text(raw.value).trim();
	const color = text(raw.color);
	if (!value || !color) return [];
	return [
		{
			value,
			label: text(raw.label) || value,
			color,
			colorLight: text(raw.colorLight),
			description: text(raw.description),
		},
	];
}

/** A bare colour string is salvaged as a colour for both themes. */
function toPathColors(raw: Record<string, unknown>): Record<string, PathColor> {
	const out: Record<string, PathColor> = {};
	for (const [path, entry] of Object.entries(raw)) {
		if (typeof entry === 'string') {
			if (entry) out[path] = { color: entry, colorLight: '' };
			continue;
		}
		if (!isRecord(entry)) continue;
		const color = text(entry.color);
		if (color) out[path] = { color, colorLight: text(entry.colorLight) };
	}
	return out;
}
