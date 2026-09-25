/**
 * Path bookkeeping and settings merging — the two places where getting it wrong
 * loses something without saying so.
 *
 * A colour keyed by a path that no longer exists simply stops being drawn, and a
 * shallow merge lets the settings tab edit the module's own defaults. Neither
 * raises anything.
 */

import { describe, expect, it } from 'vitest';
import {
	changeAndSave,
	DEFAULT_SETTINGS,
	DEFAULT_STATES,
	dataUnreadable,
	missingStateFields,
	withDefaults,
} from '../src/model';
import { recentColors } from '../src/palette';
import { isAtOrUnder, keysUnder, remapPaths } from '../src/paths';
import { resolveColors } from '../src/resolve';

describe('isAtOrUnder', () => {
	it('matches the path itself', () => {
		expect(isAtOrUnder('Projects', 'Projects')).toBe(true);
	});

	it('matches anything inside it, however deep', () => {
		expect(isAtOrUnder('Projects/A.md', 'Projects')).toBe(true);
		expect(isAtOrUnder('Projects/2026/Q3/A.md', 'Projects')).toBe(true);
	});

	// The bug this rule exists to prevent: renaming `Plan` must not touch `Plany`.
	it('does not match a sibling that merely starts with the same letters', () => {
		expect(isAtOrUnder('Plany', 'Plan')).toBe(false);
		expect(isAtOrUnder('Plany/A.md', 'Plan')).toBe(false);
	});

	it('does not match a parent', () => {
		expect(isAtOrUnder('Projects', 'Projects/A.md')).toBe(false);
	});
});

describe('keysUnder', () => {
	it('collects the folder and everything in it, and nothing else', () => {
		const keys = ['Plan', 'Plan/A.md', 'Plan/deep/B.md', 'Plany', 'Plany/C.md', 'Other.md'];
		expect(keysUnder(keys, 'Plan')).toEqual(['Plan', 'Plan/A.md', 'Plan/deep/B.md']);
	});

	it('finds nothing for a path with no entries', () => {
		expect(keysUnder(['A.md'], 'Nowhere')).toEqual([]);
	});
});

describe('remapPaths', () => {
	// The case that lost colours: only the folder arrives in the rename event,
	// while every path under it changed at the same moment.
	it('moves the folder and every path inside it', () => {
		const keys = ['Projects', 'Projects/A.md', 'Projects/2026/B.md'];
		expect(remapPaths(keys, 'Projects', 'Archive')).toEqual([
			{ from: 'Projects', to: 'Archive' },
			{ from: 'Projects/A.md', to: 'Archive/A.md' },
			{ from: 'Projects/2026/B.md', to: 'Archive/2026/B.md' },
		]);
	});

	it('moves a single note', () => {
		expect(remapPaths(['A.md', 'B.md'], 'A.md', 'C.md')).toEqual([{ from: 'A.md', to: 'C.md' }]);
	});

	it('handles a move into a different folder, not just a rename in place', () => {
		expect(remapPaths(['Inbox/A.md'], 'Inbox/A.md', 'Archive/2026/A.md')).toEqual([
			{ from: 'Inbox/A.md', to: 'Archive/2026/A.md' },
		]);
	});

	it('leaves a similarly named sibling alone', () => {
		expect(remapPaths(['Plan/A.md', 'Plany/B.md'], 'Plan', 'Schedule')).toEqual([
			{ from: 'Plan/A.md', to: 'Schedule/A.md' },
		]);
	});

	it('has nothing to move when the path carries no colours', () => {
		expect(remapPaths(['A.md'], 'B.md', 'C.md')).toEqual([]);
	});
});

describe('withDefaults', () => {
	it('fills in everything on a first install', () => {
		expect(withDefaults(null)).toEqual(DEFAULT_SETTINGS);
	});

	it('keeps stored values and fills only what is missing', () => {
		const settings = withDefaults({ statusField: 'stan' });
		expect(settings.statusField).toBe('stan');
		expect(settings.states).toHaveLength(DEFAULT_STATES.length);
	});

	// The reason this is not a plain spread: the settings tab splices `states` in
	// place, so handing out the module's own array would rewrite the defaults.
	it('hands out a copy of the default states, not the module constant', () => {
		const settings = withDefaults(null);
		expect(settings.states).not.toBe(DEFAULT_STATES);

		settings.states.splice(0, 1);
		settings.states[0]!.label = 'edited';

		expect(DEFAULT_STATES).toHaveLength(4);
		expect(DEFAULT_STATES[1]?.label).toBe('Done');
	});

	it('gives each call its own object, so two loads cannot share state', () => {
		const first = withDefaults(null);
		const second = withDefaults(null);
		first.pathColors['A.md'] = { color: '#fff', colorLight: '#000' };
		expect(second.pathColors).toEqual({});
	});

	// A hand-edited or sync-mangled data.json used to throw inside the paint on
	// every keystroke. Each case below is one that did, measured in the audit.
	describe('with a damaged data.json', () => {
		const paint = (stored: unknown) => {
			const settings = withDefaults(stored);
			resolveColors({ statusByPath: new Map([['n.md', 'x']]), settings });
			recentColors(settings.pathColors);
			return settings;
		};

		it('falls back to defaults for fields of the wrong type', () => {
			expect(paint({ pathColors: null }).pathColors).toEqual({});
			expect(paint({ states: null }).states).toEqual(DEFAULT_STATES);
			expect(paint({ statusField: 42 }).statusField).toBe('status');
			expect(paint('not an object')).toEqual(DEFAULT_SETTINGS);
		});

		it('fills in a missing light colour on a state', () => {
			const settings = paint({
				states: [{ value: 'x', label: 'X', color: '#fff', description: '' }],
			});
			expect(settings.states).toEqual([
				{ value: 'x', label: 'X', color: '#fff', colorLight: '', description: '' },
			]);
		});

		it('fills in a missing light colour on a path colour', () => {
			expect(paint({ pathColors: { 'a.md': { color: '#ff0000' } } }).pathColors).toEqual({
				'a.md': { color: '#ff0000', colorLight: '' },
			});
		});

		it('salvages a path colour stored as a bare string', () => {
			expect(paint({ pathColors: { 'a.md': '#ff0000' } }).pathColors).toEqual({
				'a.md': { color: '#ff0000', colorLight: '' },
			});
		});

		it('drops entries that cannot be salvaged and keeps the rest', () => {
			const settings = paint({
				states: [{ label: 'no value', color: '#fff' }, DEFAULT_STATES[0], 7],
				pathColors: { 'a.md': 7, 'b.md': { colorLight: '#000' }, 'c.md': { color: '#fff' } },
			});
			expect(settings.states).toEqual([DEFAULT_STATES[0]]);
			expect(Object.keys(settings.pathColors)).toEqual(['c.md']);
		});

		it('keeps an empty list of states — deleting them all is a choice', () => {
			expect(paint({ states: [] }).states).toEqual([]);
		});
	});
});

// "Save" in the state editor used to do nothing at all when a field was empty.
describe('missingStateFields', () => {
	it('names both fields when both are empty', () => {
		expect(missingStateFields({ label: '', value: '' })).toEqual(['a name', 'a value']);
	});

	it('counts blank space as nothing', () => {
		expect(missingStateFields({ label: '   ', value: 'done' })).toEqual(['a name']);
	});

	it('is empty for a complete state', () => {
		expect(missingStateFields({ label: 'Done', value: 'done' })).toEqual([]);
	});
});

// Audit SBW 2026-09-24, S-P3-01: in an ordinary object `__proto__` is the prototype.
const PROTO = '__proto__';
describe('withDefaults and a path named __proto__', () => {
	it('keeps an entry for __proto__ read back from data.json', () => {
		const stored = JSON.parse(
			'{"pathColors": {"__proto__": {"color": "#aabbcc", "colorLight": ""}}}',
		);
		const settings = withDefaults(stored);
		expect(Object.keys(settings.pathColors)).toEqual(['__proto__']);
		expect(settings.pathColors[PROTO]).toEqual({ color: '#aabbcc', colorLight: '' });
	});

	it('gives a fresh install a map that takes __proto__ as a plain key', () => {
		const settings = withDefaults(null);
		settings.pathColors[PROTO] = { color: '#aabbcc', colorLight: '' };
		expect(Object.keys(settings.pathColors)).toEqual([PROTO]);
		// Control: an ordinary folder name works the same.
		settings.pathColors.Folder = { color: '#112233', colorLight: '' };
		expect(Object.keys(settings.pathColors)).toHaveLength(2);
	});
});

// Audit SBW 2026-09-24, S-P2-02.
describe('dataUnreadable', () => {
	it('is true when the file is there but nothing came out of it', () => {
		expect(dataUnreadable(undefined, true)).toBe(true);
		expect(dataUnreadable(null, true)).toBe(true);
	});

	it('is false on a fresh install — no file at all', () => {
		expect(dataUnreadable(null, false)).toBe(false);
		expect(dataUnreadable(undefined, false)).toBe(false);
	});

	it('is false when the file was read', () => {
		expect(dataUnreadable({ states: [] }, true)).toBe(false);
	});
});

// Audit SBW 2026-09-24, S-P2-01.
describe('changeAndSave', () => {
	it('puts the memory back when saving fails', async () => {
		const settings = withDefaults(null);
		const before = settings.states.map((s) => s.value);
		await expect(
			changeAndSave(
				() => [...settings.states],
				(snapshot) => {
					settings.states = snapshot;
				},
				() => settings.states.splice(0, 1),
				async () => {
					throw new Error('disk full');
				},
			),
		).rejects.toThrow('disk full');
		expect(settings.states.map((s) => s.value)).toEqual(before);
	});

	it('keeps the change when saving works', async () => {
		const settings = withDefaults(null);
		const count = settings.states.length;
		await changeAndSave(
			() => [...settings.states],
			(snapshot) => {
				settings.states = snapshot;
			},
			() => settings.states.splice(0, 1),
			async () => {},
		);
		expect(settings.states).toHaveLength(count - 1);
	});
});
