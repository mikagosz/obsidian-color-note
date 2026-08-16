import { isValidColor } from './resolve';

/**
 * Paints the little round sample shown next to a state's name.
 *
 * The explorer refuses anything that is not plain hex (`resolve.ts`), so a swatch
 * that painted it anyway would advertise a colour the tree never uses. A value
 * typed wrong — by hand in `data.json`, or pasted as `rgb(...)` — is shown as an
 * empty outline instead, so it reads as "this is wrong" rather than "this state
 * has no colour".
 *
 * Kept out of `resolve.ts` on purpose: that module is pure, and its tests run
 * without a DOM.
 */
export function paintSwatch(swatch: HTMLElement, color: string): void {
	if (isValidColor(color)) {
		swatch.style.backgroundColor = color.trim();
		return;
	}

	swatch.addClass('is-invalid');
	swatch.setAttr('aria-label', `Not a valid colour: ${color}`);
}
