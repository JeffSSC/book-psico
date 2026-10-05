<script lang="ts">
	import { BookScene, bookMeta, bookPages } from '#lib';
</script>

<svelte:head>
	<title>{bookMeta.seo.title}</title>
	<meta name="description" content={bookMeta.seo.description} />
</svelte:head>

<main class="relative h-[100dvh] h-screen w-full overflow-hidden bg-[#FAF8F5]">
	<!-- 2D TOP-DOWN BOOK EXPERIENCE -->
	<BookScene pages={bookPages} />
</main>
