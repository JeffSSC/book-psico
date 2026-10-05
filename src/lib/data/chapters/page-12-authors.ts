import type { BasePageData } from '../../types/book';

export const page12Authors: BasePageData = {
	id: 'page-12-authors',
	pageNumber: 12,
	chapterTitle: 'Créditos',
	type: 'authors',
	title: 'Sobre os Autores',
	subtitle: 'Pesquisa, redação e concepção da obra',
	authors: [
		{
			name: 'Dra. Erica Beluzzo',
			role: 'Psicóloga Clínica & Pesquisadora',
			avatarText: 'EB'
		},
		{
			name: 'Equipe Editorial Plateia Imaginária',
			role: 'Curadoria Científica & Design Editorial',
			avatarText: 'PI'
		}
	],
	footerNote:
		'Plateia Imaginária — Uma publicação digital independente. Todos os direitos reservados.'
};
