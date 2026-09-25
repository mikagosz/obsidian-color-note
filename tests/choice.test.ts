/**
 * What a click in the picker changes, and in what order.
 *
 * The order matters because writing the front matter can fail — a note whose
 * YAML does not parse — and the plugin's own map must then stay exactly as it
 * was, instead of changing in memory without ever being saved.
 */

import { describe, expect, it } from 'vitest';
import { applyColor, applyPlan, holdsFrontMatter, isOwnState, planChoice } from '../src/choice';
import type { ColorState, PathColor } from '../src/model';

const DONE: ColorState = {
	value: 'done',
	label: 'Done',
	color: '#4c9a63',
	colorLight: '#1e6b34',
	description: '',
};

const TEAL: PathColor = { color: '#48998b', colorLight: '#2f7168' };

describe('holdsFrontMatter', () => {
	it('is true for a Markdown note', () => {
		expect(holdsFrontMatter('md')).toBe(true);
	});

	it('is false for folders and attachments', () => {
		expect(holdsFrontMatter(null)).toBe(false);
		expect(holdsFrontMatter('pdf')).toBe(false);
		expect(holdsFrontMatter('png')).toBe(false);
		expect(holdsFrontMatter('canvas')).toBe(false);
	});

	// The bug: a state chosen on a PDF dropped its colour and wrote nothing.
	it('makes a state on a PDF pin its colour instead of dropping it', () => {
		const plan = planChoice({ kind: 'state', state: DONE }, holdsFrontMatter('pdf'));
		expect(plan.pathColor).toEqual({ color: '#4c9a63', colorLight: '#1e6b34' });
		expect(plan.status).toBeUndefined();
	});
});

describe('planChoice', () => {
	it('writes a state into a note and drops any hand-picked colour', () => {
		expect(planChoice({ kind: 'state', state: DONE }, true)).toEqual({
			status: 'done',
			pathColor: null,
		});
	});

	it("pins the state's colour to an item that has no front matter", () => {
		expect(planChoice({ kind: 'state', state: DONE }, false)).toEqual({
			status: undefined,
			pathColor: { color: '#4c9a63', colorLight: '#1e6b34' },
		});
	});

	it('pins a custom colour without touching the front matter', () => {
		expect(planChoice({ kind: 'custom', ...TEAL }, true)).toEqual({
			status: undefined,
			pathColor: TEAL,
		});
	});

	// Changed on purpose in 0.3.7 (audit SBW 2026-09-24, S-P1-01): the state goes
	// only when it is one of the plugin's own.
	it("clears both the colour and the state of a note when the state is the plugin's", () => {
		expect(planChoice({ kind: 'clear' }, true, true)).toEqual({ status: null, pathColor: null });
	});

	it('leaves a status the plugin did not set, and clears only the colour', () => {
		expect(planChoice({ kind: 'clear' }, true, false)).toEqual({
			status: undefined,
			pathColor: null,
		});
		// The default is the safe side: without knowing, nothing is deleted.
		expect(planChoice({ kind: 'clear' }, true)).toEqual({ status: undefined, pathColor: null });
	});

	it('clears only the colour of an item without front matter', () => {
		expect(planChoice({ kind: 'clear' }, false)).toEqual({
			status: undefined,
			pathColor: null,
		});
	});
});

describe('applyPlan', () => {
	it('writes the state, then drops the colour', async () => {
		const colors: Record<string, PathColor> = { 'a.md': TEAL };
		const written: (string | null)[] = [];
		await applyPlan({ status: 'done', pathColor: null }, 'a.md', colors, async (value) => {
			written.push(value);
		});
		expect(written).toEqual(['done']);
		expect(colors).toEqual({});
	});

	it('leaves the map untouched when the front matter cannot be written', async () => {
		const colors: Record<string, PathColor> = { 'a.md': TEAL };
		const broken = async (): Promise<void> => {
			throw new Error('YAML could not be parsed');
		};
		await expect(
			applyPlan({ status: 'done', pathColor: null }, 'a.md', colors, broken),
		).rejects.toThrow('YAML could not be parsed');
		expect(colors).toEqual({ 'a.md': TEAL });
	});

	it('does not call the writer when the plan leaves the state alone', async () => {
		const colors: Record<string, PathColor> = {};
		let calls = 0;
		await applyPlan({ status: undefined, pathColor: TEAL }, 'Folder', colors, async () => {
			calls++;
		});
		expect(calls).toBe(0);
		expect(colors).toEqual({ Folder: TEAL });
	});
});

describe('isOwnState', () => {
	it("knows the plugin's own values", () => {
		expect(isOwnState('done', [DONE])).toBe(true);
	});

	it('does not claim a value some other tool wrote', () => {
		expect(isOwnState('zawieszony', [DONE])).toBe(false);
		expect(isOwnState('otwarte', [DONE])).toBe(false);
	});

	it('does not claim what is not text', () => {
		expect(isOwnState(undefined, [DONE])).toBe(false);
		expect(isOwnState(['done'], [DONE])).toBe(false);
		expect(isOwnState(1, [DONE])).toBe(false);
	});
});

describe('applyColor', () => {
	it('pins, then drops, a colour under a path named __proto__', () => {
		const proto = '__proto__';
		const map = Object.create(null) as Record<string, PathColor>;
		applyColor(TEAL, proto, map);
		expect(Object.keys(map)).toEqual([proto]);
		expect(map[proto]).toEqual(TEAL);
		applyColor(null, proto, map);
		expect(Object.keys(map)).toEqual([]);
	});

	it('leaves the map alone for undefined', () => {
		const map = Object.create(null) as Record<string, PathColor>;
		map.Folder = TEAL;
		applyColor(undefined, 'Folder', map);
		expect(map.Folder).toEqual(TEAL);
	});
});
