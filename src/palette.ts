import type { PathColor } from './model';

/**
 * A colour with the two shades one colour needs to survive both themes.
 *
 * `dark` is used on a dark background, `light` on a light one — the same hue,
 * moved in lightness rather than swapped for a different colour, so a note
 * painted "teal" reads as the same teal in either theme.
 */
export interface Crayon {
	name: string;
	dark: string;
	light: string;
}

/**
 * The fixed box of crayons offered in the picker.
 *
 * A slider cannot be hit twice: picking "that green again" for the fifth note
 * means knowing its hex, and one digit off is a second, almost-identical green
 * in the tree. Squares can be hit every time, which is the whole point — the
 * palette is deliberately small and deliberately does not change.
 *
 * Hues run round the wheel and no two neighbours sit on the same one, so the
 * grid stays readable as a grid. Both shades of each crayon were picked to keep
 * a title legible on the background of the theme they belong to — a title is
 * small text, not a badge.
 */
export const PALETTE: Crayon[] = [
	{ name: 'Red', dark: '#ff7b7b', light: '#c0392b' },
	{ name: 'Orange', dark: '#ff9d5c', light: '#c4551a' },
	{ name: 'Amber', dark: '#e69a3c', light: '#b35c00' },
	{ name: 'Yellow', dark: '#d9c04a', light: '#8a7500' },
	{ name: 'Olive', dark: '#8a9459', light: '#6b7340' },
	{ name: 'Green', dark: '#6bbf7b', light: '#1e6b34' },
	{ name: 'Mint', dark: '#5fd0a8', light: '#12806a' },
	{ name: 'Teal', dark: '#48998b', light: '#2f7168' },
	{ name: 'Cyan', dark: '#5cc4d6', light: '#0b6f85' },
	{ name: 'Blue', dark: '#6aa9f0', light: '#1a5fb4' },
	{ name: 'Indigo', dark: '#8f9cf5', light: '#3b3fa8' },
	{ name: 'Violet', dark: '#b28ef0', light: '#6a35a8' },
	{ name: 'Magenta', dark: '#e58ad6', light: '#9c2f8c' },
	{ name: 'Pink', dark: '#f28fa8', light: '#b02a52' },
	{ name: 'Brown', dark: '#c69a76', light: '#7a4f2c' },
	{ name: 'Slate', dark: '#a9b1bd', light: '#5a6472' },
];

/**
 * Colours already in use elsewhere in the vault, newest entry first.
 *
 * The palette covers "pick a colour"; this covers "the one I used on the other
 * three notes", which is the harder half of the same problem when the colour
 * came from the picker and lives in no list. Crayons are left out — they are on
 * the grid above already, and a row that repeats it teaches nothing.
 */
export function recentColors(pathColors: Record<string, PathColor>, limit = 8): string[] {
	const crayons = new Set(PALETTE.map((c) => c.dark.toLowerCase()));
	const seen = new Set<string>();
	const out: string[] = [];

	for (const entry of Object.values(pathColors).reverse()) {
		const color = entry.color.trim().toLowerCase();
		if (!color || crayons.has(color) || seen.has(color)) continue;
		seen.add(color);
		out.push(entry.color.trim());
		if (out.length === limit) break;
	}

	return out;
}
