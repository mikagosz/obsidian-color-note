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
 * @param holdsState whether the item has front matter a state can be written into.
 *   A folder has none, so it keeps the state's colour rather than the state itself.
 */
export function planChoice(choice: ColorChoice, holdsState: boolean): ChoicePlan {
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
			return { status: holdsState ? null : undefined, pathColor: null };
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

	if (plan.pathColor === null) delete pathColors[path];
	else if (plan.pathColor !== undefined) pathColors[path] = plan.pathColor;
}
