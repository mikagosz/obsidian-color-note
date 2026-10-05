/**
 * Marks a button as destructive on every Obsidian the plugin supports.
 *
 * `setWarning` is deprecated in favour of `setDestructive`, which only exists
 * from Obsidian 1.13. minAppVersion is 1.12.7, so the new call is used where it
 * is there and the old one stays as the fallback — nobody on 1.12 loses the
 * red button, and nobody on 1.13+ runs the deprecated one.
 *
 * Structural type rather than `ButtonComponent`, so this file does not import
 * "obsidian" and the tests can run it as it is.
 */
export interface DestructiveButton {
	setDestructive?: () => unknown;
	setWarning: () => unknown;
}

export function markDestructive<T extends DestructiveButton>(button: T): T {
	if (typeof button.setDestructive === 'function') {
		button.setDestructive();
	} else {
		button.setWarning();
	}
	return button;
}
