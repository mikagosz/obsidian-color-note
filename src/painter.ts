import type { ResolvedColor } from './resolve';

const DARK = '--color-note-dark';
const LIGHT = '--color-note-light';
const MARKER = 'data-color-note';

/**
 * Puts the colours onto the file explorer rows.
 *
 * Two custom properties go on each row, one per theme, and `styles.css` picks
 * whichever matches. Switching the theme therefore needs no work here — and,
 * more to the point, the plugin never creates a `style` element, which
 * Obsidian's guidelines forbid.
 *
 * The rows are re-created as they scroll in and out of view, so painting is not
 * a one-off: a `MutationObserver` repaints whatever the explorer rebuilds.
 */
export class ExplorerPainter {
	private colors = new Map<string, ResolvedColor>();
	private observer: MutationObserver | null = null;
	private frame: number | null = null;

	/** Starts watching the explorer and paints what is already on screen. */
	start(): void {
		this.observer = new MutationObserver(() => this.schedule());
		this.observer.observe(document.body, { childList: true, subtree: true });
		this.paint();
	}

	stop(): void {
		this.observer?.disconnect();
		this.observer = null;
		if (this.frame !== null) window.cancelAnimationFrame(this.frame);
		this.clearAll();
	}

	setColors(colors: Map<string, ResolvedColor>): void {
		this.colors = colors;
		this.paint();
	}

	/**
	 * The observer fires for every row the explorer touches, so work is
	 * collapsed into one pass per frame instead of one per mutation.
	 */
	private schedule(): void {
		if (this.frame !== null) return;
		this.frame = window.requestAnimationFrame(() => {
			this.frame = null;
			this.paint();
		});
	}

	private paint(): void {
		const titles = document.querySelectorAll<HTMLElement>(
			'.nav-file-title[data-path], .nav-folder-title[data-path]',
		);

		for (const title of titles) {
			const path = title.getAttribute('data-path');
			const color = path === null ? undefined : this.colors.get(path);

			if (!color) {
				// A row can be recycled from a coloured path to an uncoloured
				// one, so stale properties have to be taken off explicitly.
				if (title.hasAttribute(MARKER)) this.clear(title);
				continue;
			}

			title.setAttribute(MARKER, '');
			title.style.setProperty(DARK, color.dark);
			title.style.setProperty(LIGHT, color.light);
		}
	}

	private clear(title: HTMLElement): void {
		title.removeAttribute(MARKER);
		title.style.removeProperty(DARK);
		title.style.removeProperty(LIGHT);
	}

	/** Leaves the explorer exactly as it was found — the plugin can be disabled. */
	private clearAll(): void {
		for (const title of document.querySelectorAll<HTMLElement>(`[${MARKER}]`)) {
			this.clear(title);
		}
	}
}
