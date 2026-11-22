<script lang="ts">
	import { BookScene, bookMeta, comic } from '#lib';
</script>

<svelte:head>
	<title>{bookMeta.seo.title}</title>
	<meta name="description" content={bookMeta.seo.description} />
</svelte:head>

<main>
	<BookScene {comic} />
</main>
