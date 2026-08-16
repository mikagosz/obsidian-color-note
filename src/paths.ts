/**
 * Path bookkeeping for the `path → colour` map.
 *
 * Colours are keyed by full vault path, so anything that moves a path has to move
 * its colour with it. Renaming a folder is the hard case: one event arrives, for
 * the folder, while every path underneath changes at the same moment.
 *
 * Pure on purpose — no Obsidian, no DOM — because getting the prefix rule wrong
 * is silent. Colours simply disappear, and stale keys pile up in `data.json`.
 */

/**
 * True for `path` itself and for anything inside it.
 *
 * The separator is part of the test deliberately: a plain `startsWith` would let
 * a rename of `Plan` drag `Plany` along with it.
 */
export function isAtOrUnder(key: string, path: string): boolean {
	return key === path || key.startsWith(`${path}/`);
}

/** Every key at or under `path`. */
export function keysUnder(keys: readonly string[], path: string): string[] {
	return keys.filter((key) => isAtOrUnder(key, path));
}

/**
 * The moves needed when `oldPath` becomes `newPath`: the path itself, plus
 * everything under it, with the rest of each key left untouched.
 */
export function remapPaths(
	keys: readonly string[],
	oldPath: string,
	newPath: string,
): { from: string; to: string }[] {
	return keysUnder(keys, oldPath).map((key) => ({
		from: key,
		to: newPath + key.slice(oldPath.length),
	}));
}
