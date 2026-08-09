import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, DEFAULT_STATES } from '../src/model';
import { isValidColor, resolveColors } from '../src/resolve';

const settings = (overrides = {}) => ({ ...DEFAULT_SETTINGS, ...overrides });

describe('isValidColor', () => {
	it('accepts the two hex forms', () => {
		expect(isValidColor('#abc')).toBe(true);
		expect(isValidColor('#AABBCC')).toBe(true);
		expect(isValidColor('  #4c9a63  ')).toBe(true);
	});

	// The value ends up in an inline custom property, so anything that is not
	// plainly a colour is refused rather than sanitised.
	it('refuses anything that could carry more than a colour', () => {
		expect(isValidColor('red')).toBe(false);
		expect(isValidColor('#abcd')).toBe(false);
		expect(isValidColor('#4c9a63; background: url(http://x)')).toBe(false);
		expect(isValidColor('')).toBe(false);
	});
});

describe('resolveColors', () => {
	it('paints a note that carries a known state', () => {
		const colors = resolveColors({
			statusByPath: new Map([['Projects/A.md', 'done']]),
			settings: settings(),
		});
		expect(colors.get('Projects/A.md')).toEqual({ dark: '#4c9a63', light: '#1e6b34' });
	});

	it('ignores a state nobody defined', () => {
		const colors = resolveColors({
			statusByPath: new Map([['A.md', 'no-such-state']]),
			settings: settings(),
		});
		expect(colors.size).toBe(0);
	});

	// A one-off colour is picked by hand for one item; the state is a rule of
	// thumb. The hand-picked one wins.
	it('lets a hand-picked colour beat the note state', () => {
		const colors = resolveColors({
			statusByPath: new Map([['A.md', 'done']]),
			settings: settings({ pathColors: { 'A.md': { color: '#123456', colorLight: '#123456' } } }),
		});
		expect(colors.get('A.md')?.dark).toBe('#123456');
	});

	it('colours a folder, which can only ever have a hand-picked colour', () => {
		const colors = resolveColors({
			statusByPath: new Map(),
			settings: settings({
				pathColors: { 'Programs': { color: '#abc', colorLight: '#123' } },
			}),
		});
		expect(colors.get('Programs')).toEqual({ dark: '#abc', light: '#123' });
	});

	it('drops a state whose colour was typed wrong instead of emitting it', () => {
		const broken = [{ ...DEFAULT_STATES[0], color: 'rgb(255,0,0)' }];
		const colors = resolveColors({
			statusByPath: new Map([['A.md', 'open']]),
			settings: settings({ states: broken }),
		});
		expect(colors.size).toBe(0);
	});

	it('falls back to the dark colour when no light one was given', () => {
		const single = [{ ...DEFAULT_STATES[0], color: '#abcdef', colorLight: '' }];
		const colors = resolveColors({
			statusByPath: new Map([['A.md', 'open']]),
			settings: settings({ states: single }),
		});
		expect(colors.get('A.md')).toEqual({ dark: '#abcdef', light: '#abcdef' });
	});

	// Paths are keys in a map and values of a data attribute — a title built to
	// break a selector is just an ordinary string here, and must stay one.
	it('treats a title written to break a selector as ordinary text', () => {
		const hostile = 'x"] { color: red } [data-path="y.md';
		const colors = resolveColors({
			statusByPath: new Map([[hostile, 'open']]),
			settings: settings(),
		});
		expect(colors.get(hostile)?.dark).toBe('#ff7b7b');
		expect(colors.size).toBe(1);
	});
});
