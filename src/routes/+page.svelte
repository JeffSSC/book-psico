<script lang="ts">
	import { Book3DExperience, bookMeta, bookPages } from '#lib';
</script>

<svelte:head>
	<title>{bookMeta.seo.title}</title>
	<meta name="description" content={bookMeta.seo.description} />
</svelte:head>

<main class="relative h-[100dvh] h-screen w-full overflow-hidden bg-[#FAF8F5]">
	<!-- 3D BOOK EXPERIENCE & HYBRID DOM READER -->
	<Book3DExperience pages={bookPages} />
</main>
