import type { BasePageData } from '../../types/book';

export const page02Introduction: BasePageData = {
	id: 'page-02-introduction',
	pageNumber: 2,
	type: 'standard',
	chapterTitle: 'Introdução Geral',
	title: 'O Palco Invisível',
	subtitle: 'Por que sentimos que todos os olhos estão voltados para nós?',
	epigraph: {
		quote:
			'O jovem vive como se estivesse continuamente em cena diante de um público atento e crítico, cuja atenção ele imagina estar sempre fixada nele próprio.',
		author: 'David Elkind, Egocentrism in Adolescence (1967)'
	},
	paragraphs: [
		'Quantas vezes você entrou em uma sala e teve a certeza imediata de que todos repararam na sua roupa, na sua postura ou na pequena hesitação de sua voz?',
		'Essa sensação de escrutínio constante não é um defeito de caráter nem uma fragilidade isolada. Trata-se de um dos fenômenos mais universais da psicologia do desenvolvimento: a plateia imaginária.',
		'Neste livro, percorremos as raízes cognitivas e emocionais desse mecanismo, desmistificamos os equívocos mais comuns sobre a mente jovem e oferecemos caminhos práticos para desarmar o palco interior e reencontrar a autenticidade.'
	],
	callout: {
		title: 'Premissa Central',
		text: 'A plateia imaginária nasce da incapacidade temporária de diferenciar o que é objeto do nosso próprio interesse daquilo que realmente ocupa a mente das outras pessoas.',
		type: 'insight'
	}
};
