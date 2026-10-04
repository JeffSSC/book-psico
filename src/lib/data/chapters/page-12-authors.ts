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
			name: 'Dr. Jefferson Santos',
			role: 'Psicólogo Clínico & Pesquisador',
			bio: 'Especialista em psicologia do desenvolvimento e dinâmica das relações sociais na adolescência, com foco em ansiedade social e intervenções psicoeducativas digitais.',
			avatarText: 'JS'
		},
		{
			name: 'Equipe Editorial Plateia Imaginária',
			role: 'Curadoria Científica & Design Editorial',
			bio: 'Coletivo dedicado à divulgação científica acessível e ao desenvolvimento de experiências interativas focadas em autoconhecimento e saúde mental.',
			avatarText: 'PI'
		}
	],
	footerNote:
		'Plateia Imaginária — Uma publicação digital independente. Todos os direitos reservados.'
};
