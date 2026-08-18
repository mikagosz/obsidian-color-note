import { describe, expect, it } from 'vitest';
import type { PathColor } from '../src/model';
import { PALETTE, recentColors } from '../src/palette';
import { isValidColor } from '../src/resolve';

describe('PALETTE', () => {
	it('offers only colours the explorer will actually paint', () => {
		for (const crayon of PALETTE) {
			expect(isValidColor(crayon.dark), `${crayon.name} dark`).toBe(true);
			expect(isValidColor(crayon.light), `${crayon.name} light`).toBe(true);
		}
	});

	it('has no duplicate square — two identical chips would be a trap, not a choice', () => {
		const darks = PALETTE.map((c) => c.dark.toLowerCase());
		expect(new Set(darks).size).toBe(darks.length);
		const names = PALETTE.map((c) => c.name);
		expect(new Set(names).size).toBe(names.length);
	});

	it('gives every crayon a different shade per theme, or deliberately the same', () => {
		// Not a rule about which is darker — only that both are stated, so no
		// crayon quietly falls back to one colour for both themes.
		for (const crayon of PALETTE) {
			expect(crayon.light.length, crayon.name).toBeGreaterThan(0);
		}
	});
});

describe('recentColors', () => {
	const entry = (color: string): PathColor => ({ color, colorLight: color });

	it('lists what the vault already uses, newest first', () => {
		const colors = recentColors({
			'a.md': entry('#123456'),
			'b.md': entry('#abcdef'),
		});
		expect(colors).toEqual(['#abcdef', '#123456']);
	});

	it('leaves out the crayons, which are on the grid above', () => {
		const crayon = PALETTE[0]?.dark ?? '#ff7b7b';
		expect(recentColors({ 'a.md': entry(crayon), 'b.md': entry('#123456') })).toEqual(['#123456']);
	});

	it('shows one colour once, however many notes wear it', () => {
		expect(recentColors({ 'a.md': entry('#123456'), 'b.md': entry('#123456') })).toEqual([
			'#123456',
		]);
	});

	it('stops at the limit rather than filling the dialog', () => {
		const many: Record<string, PathColor> = {};
		for (let i = 0; i < 20; i++) many[`n${i}.md`] = entry(`#0000${i.toString(16)}0`);
		expect(recentColors(many)).toHaveLength(8);
	});

	it('returns nothing when no colour was ever picked', () => {
		expect(recentColors({})).toEqual([]);
	});
});
