import type { BasePageData } from '../../types/book';

export const page03Index: BasePageData = {
	id: 'page-03-index',
	pageNumber: 3,
	type: 'index',
	chapterTitle: 'Sumário',
	title: 'Índice Geral',
	subtitle: 'Guia de leitura e estrutura temática dos capítulos',
	indexEntries: [
		{ title: 'Introdução Geral: O Palco Invisível', pageNumber: 2 },
		{ title: 'Capítulo 1: Introdução à Adolescência', pageNumber: 4, chapterNumber: 1 },
		{ title: 'Capítulo 2: Aspectos da Adolescência', pageNumber: 5, chapterNumber: 2 },
		{ title: 'Capítulo 3: Estágios de Desenvolvimento', pageNumber: 6, chapterNumber: 3 },
		{ title: 'Capítulo 4: Mitos e Verdades', pageNumber: 7, chapterNumber: 4 },
		{ title: 'Capítulo 5: Como Ajudar — Intervenções e Práticas', pageNumber: 8, chapterNumber: 5 },
		{ title: 'Capítulo 6: Situações Práticas e Casos Clínicos', pageNumber: 9, chapterNumber: 6 },
		{ title: 'Conclusão: A Conquista da Autonomia Saudável', pageNumber: 10 },
		{ title: 'Referências Bibliográficas', pageNumber: 11 },
		{ title: 'Sobre os Autores', pageNumber: 12 }
	]
};
