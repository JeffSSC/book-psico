import type { BookUiCopy } from '../types/book';

/**
 * Every user-facing label that is not page content.
 *
 * The painters and components are deliberately blank: they read these strings
 * instead of shipping the book's copy inline. `{token}` placeholders are
 * expanded with {@link fillCopy}.
 */
export const bookUiCopy: BookUiCopy = {
	/** Overlay floating above the closed book on the reading desk. */
	experience: {
		regionLabel: 'Livro {title} sobre a mesa de leitura',
		openLabel: 'Abrir Livro',
		openButtonLabel: 'Abrir livro sobre a mesa',
		openHint: 'Clique no livro para abrir',
		clickToOpenLabel: 'Clique para abrir o livro'
	},

	/** Buttons and counters baked into every page texture. */
	chrome: {
		closeLabel: 'Fechar',
		closeRegionLabel: 'Fechar livro',
		pageCounterTemplate: 'Página {current} de {total}',
		previousLabel: 'Anterior',
		nextLabel: 'Próxima',
		keyboardHint: 'Use as setas ← / → para folhear'
	},

	/** Sumário dialog and the control that opens it. */
	tableOfContents: {
		dialogLabel: 'Sumário do Livro',
		heading: 'Sumário da Obra',
		subtitle: 'Selecione uma página para folhear diretamente',
		closeLabel: 'Fechar sumário',
		coverTitleFallback: 'Capa do Livro',
		pageTitleFallback: 'Prólogo',
		interactiveBadge: 'Interativo',
		readingNow: 'Lendo agora',
		progressTemplate: 'Progresso: {percent}%',
		totalTemplate: 'Total: {count} páginas',
		buttonLabel: 'Sumário',
		buttonTitle: 'Abrir Sumário do Livro'
	},

	/** Audio toggle. */
	audio: {
		onTitle: 'Efeitos sonoros ativados (clique para silenciar)',
		offTitle: 'Efeitos sonoros desativados (clique para ativar)',
		toggleLabel: 'Alternar áudio',
		onLabel: 'Som',
		offLabel: 'Mudo',
		onLabelLong: 'Som Ligado',
		offLabelLong: 'Mudo'
	},

	/** Flat DOM reader chrome. */
	reader: {
		regionLabel: 'Página do Livro',
		closeTitle: 'Fechar o livro e voltar à capa (Esc)',
		closeLabel: 'Fechar Livro',
		previousRegionLabel: 'Página anterior',
		nextRegionLabel: 'Próxima página'
	},

	/** Headings a page falls back to when it carries none of its own. */
	sections: {
		index: 'Sumário',
		indexTitle: 'Índice Geral',
		references: 'Bibliografia',
		referencesTitle: 'Referências Bibliográficas',
		authors: 'Créditos',
		authorsTitle: 'Sobre os Autores',
		standard: 'Ensaio',
		chapterLabelTemplate: 'Capítulo {number} • {title}'
	},

	/** Answer controls. */
	interactive: {
		badge: 'Atividade Interativa',
		selectHint: 'Selecione uma opção',
		reflectionTitle: 'Análise Psicológica:',
		canvasBadge: 'ATIVIDADE INTERATIVA',
		canvasReflectionTitle: 'ANÁLISE PSICOLÓGICA'
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
