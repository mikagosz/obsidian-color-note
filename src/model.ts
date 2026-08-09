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
