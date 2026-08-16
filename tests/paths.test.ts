/**
 * Path bookkeeping and settings merging — the two places where getting it wrong
 * loses something without saying so.
 *
 * A colour keyed by a path that no longer exists simply stops being drawn, and a
 * shallow merge lets the settings tab edit the module's own defaults. Neither
 * raises anything.
 */

import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, DEFAULT_STATES, withDefaults } from '../src/model';
import { isAtOrUnder, keysUnder, remapPaths } from '../src/paths';

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
});
