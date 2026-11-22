import type { BookFace, Comic, ComicPage, PageSide, PageSources, ViewMode } from '../types/book';
import { bookMeta } from './bookMeta';
import manifest from './hqManifest.json';

/**
 * The HQ as data: the cover and the 14 story pages in reading order. All
 * lettering is in the art, so a page is an image plus its alt text.
 */

/** Hashed URLs of every page image, keyed by `NN-<width>.<format>`. */
const imageUrls = Object.fromEntries(
	Object.entries(
		import.meta.glob<string>('../assets/hq/*.{avif,webp}', {
			eager: true,
			query: '?url',
			import: 'default'
		})
	).map(([path, url]) => [path.slice(path.lastIndexOf('/') + 1), url])
);

/** Widths every page image is published at; the last is the largest. */
const WIDTHS = [720, 1400];

/** Title and description of each story page, in the order of images 2–15. */
const STORY_PAGES: Array<{ title: string; description: string }> = [
	{
		title: 'Sumário',
		description:
			'Pergaminho com os doze capítulos da HQ, de Introdução a Além do parque, entre folhas, uma mochila, livros, uma bússola e uma capivara de chapéu.'
	},
	{
		title: 'Introdução',
		description:
			'Texto sobre as mudanças da adolescência e a plateia imaginária de Elkind: a sensação de estar sendo observado o tempo todo. Abaixo, um sapo, uma capivara e um lobo-guará descansam à beira de um lago.'
	},
	{
		title: 'O portão',
		description:
			'Leo sai da escola entre colegas que riem, entra sozinho no Parque dos Mil Olhos em busca de calma e sente como se um refletor o seguisse. Um lobo-guará o observa de longe.'
	},
	{
		title: 'O parque dos mil olhos',
		description:
			'Leo tropeça numa raiz, vê no lago o reflexo de uma espinha e imagina que todos repararam nela. Frutos vermelhos em forma de olho o encaram entre as raízes; o lobo-guará passa ao fundo.'
	},
	{
		title: 'A capivara pescadora',
		description:
			'Leo pisa num galho e assusta uma capivara que pescava em paz. Certo de que ela o acha um idiota, pede desculpas e foge, enquanto ela só queria avisar que o cadarço dele estava desamarrado.'
	},
	{
		title: 'O sapo',
		description:
			'Leo admira a segurança de um sapo de óculos escuros deitado numa vitória-régia, prende a camiseta no zíper e conclui que o sapo o julga. Sai correndo; o sapo só aproveitava o fim de tarde.'
	},
	{
		title: 'A mensagem',
		description:
			'O celular vibra: o grupo da turma volta a compartilhar um vídeo de Leo apresentando um trabalho, com risadas. Ele lembra da humilhação na sala, pensa que só queria se encaixar e corre, cercado por olhos vermelhos.'
	},
	{
		title: 'O desespero',
		description:
			'Sem ar e de joelhos, Leo vê o parque inteiro coberto de olhos e acredita que o mundo todo o julga. Chorando, pede que parem de olhar, até que o lobo-guará se aproxima e diz que está tudo bem.'
	},
	{
		title: 'O lobo guará',
		description:
			'O Guará ensina Leo a respirar devagar, diz que não há fraqueza em chorar e pede que ele olhe de perto: os olhos são guaranás, uma fruta da terra que a dor dele transformou em plateia imaginária.'
	},
	{
		title: 'O mito e a verdade',
		description:
			'O Guará ajuda Leo a separar fato de suposição: a capivara e o sapo não o julgavam; o vídeo na escola aconteceu de verdade, foi errado e deve ser contado a um adulto. Leo entende que merece respeito.'
	},
	{
		title: 'A calmaria',
		description:
			'Caminhando junto a uma cachoeira, Leo pergunta quem ele é. O Guará responde que aos quinze anos ninguém sabe e que a identidade se constrói aos poucos. Leo sorri para o próprio reflexo e segura um cacho de guaraná.'
	},
	{
		title: 'A despedida',
		description:
			'O parque se enche de vaga-lumes. No portão, o Guará diz que agora mora no peito de Leo, os dois se abraçam e Leo volta para casa à noite, tendo aprendido a ser amigo de si mesmo. Fim.'
	},
	{
		title: 'Além do parque',
		description:
			'Guia com sinais de alerta de ansiedade e de bullying, o que fazer ao percebê-los (respirar, voltar ao presente, separar fatos de suposições, não ficar sozinho) e onde buscar ajuda: escola, UBS, CVV 188 e SAMU 192.'
	},
	{
		title: 'Bibliografia',
		description:
			'Referências em um pergaminho: Elkind (1967), Papalia e Martorell, Gaete (2015) e Oka et al. (2025).'
	}
];

function geometry(image: number): Pick<ComicPage, 'width' | 'height' | 'color'> {
	const entry = manifest.find((item) => item.page === image);
	if (!entry) throw new Error(`hqManifest.json has no page ${image}; run pnpm hq:build`);
	return { width: entry.width, height: entry.height, color: entry.color };
}

const cover: ComicPage = {
	id: 'capa',
	image: 1,
	title: bookMeta.title,
	alt: `Capa da HQ ${bookMeta.title}: um portão de ferro aberto para a trilha de um parque à noite, sob a lua cheia.`,
	...geometry(1)
};

const pages: ComicPage[] = STORY_PAGES.map(({ title, description }, index) => ({
	id: `pagina-${String(index + 1).padStart(2, '0')}`,
	image: index + 2,
	title,
	alt: `${title} — página ${index + 1} de ${STORY_PAGES.length}. ${description}`,
	...geometry(index + 2)
}));

export const comic: Comic = { cover, pages };

/** Every face of the book in reading order: cover, story pages, back cover. */
export function bookFaces(book: Comic): BookFace[] {
	const page = (entry: ComicPage): BookFace => ({ kind: 'page', id: entry.id, page: entry });
	return [page(book.cover), ...book.pages.map(page), { kind: 'back', id: 'contracapa' }];
}

/**
 * The faces as the sides of spreads: an empty side goes before the cover
 * and after the back cover, so each lies alone on its half of the book.
 */
export function bookSides(book: Comic): (BookFace | null)[] {
	return [null, ...bookFaces(book), null];
}

function imageUrl(image: number, width: number, format: 'avif' | 'webp'): string {
	const name = `${String(image).padStart(2, '0')}-${width}.${format}`;
	const url = imageUrls[name];
	if (!url) throw new Error(`Missing page image ${name}; run pnpm hq:build`);
	return url;
}

/**
 * Sources for a page's `<picture>`: AVIF and WebP srcsets plus a WebP
 * fallback. Descriptors use the nominal width of each published size.
 */
export function pageSources(page: ComicPage): PageSources {
	const srcset = (format: 'avif' | 'webp') =>
		WIDTHS.map((width) => `${imageUrl(page.image, width, format)} ${width}w`).join(', ');
	return {
		avif: srcset('avif'),
		webp: srcset('webp'),
		src: imageUrl(page.image, WIDTHS[0], 'webp'),
		width: page.width,
		height: page.height
	};
}

/**
 * Indexes of the story pages the next forward step will show, so they can
 * be fetched while the reader is still on the current ones.
 */
export function pagesToPreload(
	position: { spreadIndex: number; side: PageSide },
	mode: ViewMode,
	totalPages: number
): number[] {
	const firstOfNextSpread = (position.spreadIndex + 1) * 2;
	const next =
		mode === 'spread'
			? [firstOfNextSpread, firstOfNextSpread + 1]
			: [position.side === 'left' ? position.spreadIndex * 2 + 1 : firstOfNextSpread];
	return next.filter((index) => index < totalPages);
}
