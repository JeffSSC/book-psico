import type { BookMeta } from '../types/book';

/**
 * Book-level copy: everything the surfaces print about the work as a whole,
 * as opposed to the per-page content in `chapters/`.
 *
 * The components and the canvas painters hold none of this inline — they read
 * it from here, so re-skinning the book means editing data only.
 */
export const bookMeta: BookMeta = {
	title: 'Plateia Imaginária',
	seo: {
		title: 'Plateia Imaginária — Livro Interativo 3D de Psicologia',
		description:
			'Um livro digital interativo em 3D sobre o fenômeno da plateia imaginária, egocentrismo e a psicologia do julgamento social.'
	},

	/** Gold foil lettering baked into the 3D front board. */
	cover: {
		badge: 'ENSAIO PSICOLÓGICO',
		titleLines: ['PLATEIA', 'IMAGINÁRIA'],
		subtitleLines: ['A Ilusão do Olhar Alheio e a Psicologia', 'do Julgamento Social'],
		credits: 'Erica Beluzzo - Danielle - Gabrielle Servolo - Daniela - Laura',
		edition: 'EDIÇÃO CIENTÍFICA & INTERATIVA'
	},

	/** The single static mark every sheet back carries. */
	back: {
		title: 'PLATEIA IMAGINÁRIA',
		quote:
			'“Descobrir que o mundo não está nos vigiando é o primeiro passo para a liberdade de ser.”',
		badge: 'ENSAIO PSICOLÓGICO INTERATIVO'
	},

	/** Cover furniture painted onto the paper texture. */
	titlePage: {
		badge: 'ENSAIO PSICOLÓGICO',
		kicker: 'CADERNO CIENTÍFICO & REFLEXIVO'
	},

	/** The same cover furniture as the DOM reader spells it. */
	titlePageDom: {
		badge: 'Ensaio Psicológico',
		kicker: 'Caderno Científico & Reflexivo'
	}
};
