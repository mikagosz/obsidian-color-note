/**
 * The red button has to work on both sides of Obsidian 1.13: setDestructive
 * where it exists, the deprecated setWarning only where it does not.
 */

import { describe, expect, it } from 'vitest';
import { markDestructive } from '../src/destructive';

function button(withDestructive: boolean) {
	const calls: string[] = [];
	return {
		calls,
		setWarning: () => calls.push('setWarning'),
		...(withDestructive ? { setDestructive: () => calls.push('setDestructive') } : {}),
	};
}

describe('markDestructive', () => {
	it('uses setDestructive on Obsidian 1.13+', () => {
		const b = button(true);
		expect(markDestructive(b)).toBe(b);
		expect(b.calls).toEqual(['setDestructive']);
	});

	it('falls back to setWarning on Obsidian 1.12', () => {
		const b = button(false);
		expect(markDestructive(b)).toBe(b);
		expect(b.calls).toEqual(['setWarning']);
	});
});
