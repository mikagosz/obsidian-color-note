import type { ColorState, PathColor } from './model';

/** What the picker hands back. */
export type ColorChoice =
	| { kind: 'state'; state: ColorState }
	| { kind: 'custom'; color: string; colorLight: string }
	| { kind: 'clear' };

/**
 * What one choice changes, worked out before anything is touched.
 *
 * `undefined` means "leave it alone" in both fields; `null` means "remove it".
 * Pure, so the rules can be tested without Obsidian.
 */
export interface ChoicePlan {
	/** The front matter state to write, `null` to remove it, `undefined` to leave it. */
	status: string | null | undefined;
	/** The hand-picked colour to pin, `null` to drop it, `undefined` to leave it. */
	pathColor: PathColor | null | undefined;
}

/**
 * Whether a state can be written into this item. Only Markdown notes carry
 * front matter; folders (`null`), PDFs, images and canvases do not.
 *
 * Treating every file as a note sent a PDF down the note path: its colour was
 * dropped to make room for a state that could never be written, so choosing a
 * state removed the colour and put nothing in its place.
 */
export function holdsFrontMatter(extension: string | null): boolean {
	return extension === 'md';
}

/**
 * Whether a front matter value is one of the plugin's own states.
 *
 * The field is shared: the vault's CSS snippet, Dataview and other tools read and
 * write it too, with values the plugin has never heard of. Only a value the plugin
 * knows is the plugin's to remove.
 */
export function isOwnState(value: unknown, states: readonly Pick<ColorState, 'value'>[]): boolean {
	return typeof value === 'string' && states.some((state) => state.value === value);
}

/**
 * @param holdsState whether the item has front matter a state can be written into.
 *   A folder or an attachment has none, so it keeps the state's colour rather than
 *   the state itself.
 * @param ownsStatus whether the note's current value in the field is one of the
 *   plugin's states. "Remove colour" takes that value away, and nothing else.
 */
export function planChoice(
	choice: ColorChoice,
	holdsState: boolean,
	ownsStatus = false,
): ChoicePlan {
	switch (choice.kind) {
		case 'state':
			if (!holdsState) {
				// It stops being a state at that moment: recolour the state later
				// and the item stays as it is — a note would follow.
				return {
					status: undefined,
					pathColor: { color: choice.state.color, colorLight: choice.state.colorLight },
				};
			}
			// A hand-picked colour would otherwise keep overriding the state the
			// user just chose, and the menu would look broken.
			return { status: choice.state.value, pathColor: null };

		case 'custom':
			return {
				status: undefined,
				pathColor: { color: choice.color, colorLight: choice.colorLight },
			};

		case 'clear':
			// A value the plugin did not set is not its to delete: "Remove colour"
			// on a note marked `status: zawieszony` took the status with it.
			return { status: holdsState && ownsStatus ? null : undefined, pathColor: null };
	}
}

/**
 * Carries a plan out: the note first, the plugin's own map second.
 *
 * The order is the point. Writing the front matter is the step that can fail —
 * a note whose YAML does not parse, a file gone in the meantime — and when it
 * does, the map has to be exactly as it was. Editing the map first left it
 * changed in memory, unsaved, and out of step with `data.json`.
 */
export async function applyPlan(
	plan: ChoicePlan,
	path: string,
	pathColors: Record<string, PathColor>,
	writeStatus: (value: string | null) => Promise<void>,
): Promise<void> {
	if (plan.status !== undefined) await writeStatus(plan.status);
	applyColor(plan.pathColor, path, pathColors);
}

/** The map half of a plan: pin, drop, or leave the hand-picked colour. */
export function applyColor(
	pathColor: ChoicePlan['pathColor'],
	path: string,
	pathColors: Record<string, PathColor>,
): void {
	if (pathColor === null) delete pathColors[path];
	else if (pathColor !== undefined) pathColors[path] = pathColor;
}
