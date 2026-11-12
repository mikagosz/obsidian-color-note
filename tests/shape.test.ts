/**
 * data.json that parses but has the wrong shape, and field names a plain object
 * cannot hold. Both used to lose something without a word: the first save wrote
 * defaults over the real colours, or picking a state wrote nothing.
 */

import { describe, expect, it } from 'vitest';
import { dataUnreadable, fieldName, withDefaults, wrongShape } from '../src/model';

const state = { value: 'mine', label: 'Mine', color: '#112233', colorLight: '', description: '' };

describe('wrongShape', () => {
	it('names fields of the wrong kind', () => {
		expect(wrongShape({ states: [state], pathColors: [{ a: '#445566' }] })).toEqual(['pathColors']);
		expect(wrongShape({ states: { 0: state } })).toEqual(['states']);
		expect(wrongShape({ statusField: 5 })).toEqual(['statusField']);
	});

	it('flags a file that is not an object at all', () => {
		expect(wrongShape([])).toEqual(['data.json']);
		expect(wrongShape('abc')).toEqual(['data.json']);
	});

	it('accepts the expected shape and missing fields', () => {
		expect(wrongShape({ states: [state], pathColors: {}, statusField: 'status' })).toEqual([]);
		expect(wrongShape({})).toEqual([]);
	});
});

describe('dataUnreadable with a wrong shape', () => {
	it('blocks saving when a field has the wrong kind', () => {
		expect(dataUnreadable({ states: [state], pathColors: [] }, true)).toBe(true);
		expect(dataUnreadable({ states: { 0: state } }, true)).toBe(true);
	});

	it('never blocks a file that does not exist', () => {
		expect(dataUnreadable([], false)).toBe(false);
	});
});

describe('fieldName', () => {
	it('falls back to the default for names an object cannot hold', () => {
		for (const name of [
			'__proto__',
			'constructor',
			'prototype',
			' __proto__ ',
			'',
			'  ',
			null,
			5,
		]) {
			expect(fieldName(name)).toBe('status');
		}
	});

	it('keeps an ordinary name, trimmed', () => {
		expect(fieldName(' stan ')).toBe('stan');
		expect(withDefaults({ statusField: '__proto__' }).statusField).toBe('status');
	});
});
