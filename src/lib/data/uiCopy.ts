import type { BookUiCopy } from '../types/book';

/**
 * Every user-facing label that is not part of the art.
 *
 * The components are deliberately blank: they read these strings instead of
 * shipping copy inline. `{token}` placeholders are expanded with
 * {@link fillCopy}.
 */
export const bookUiCopy: BookUiCopy = {
	/** The closed HQ: the cover is the way in. */
	experience: {
		regionLabel: 'HQ {title}',
		openLabel: 'Abrir a HQ'
	},

	/** Names of the two click areas over the pages, and of the back cover. */
	reader: {
		previousRegionLabel: 'Página anterior',
		nextRegionLabel: 'Próxima página',
		returnToCoverLabel: 'Voltar à capa',
		backCoverLabel: 'Contracapa'
	}
};

/**
 * Substitutes `{token}` placeholders in a copy template. Unknown tokens are left
 * untouched so a typo shows up in the interface instead of silently dropping
 * words from a label.
 */
export function fillCopy(template: string, values: Record<string, string | number>): string {
	return template.replace(/\{(\w+)\}/g, (match, token: string) =>
		token in values ? String(values[token]) : match
	);
}
