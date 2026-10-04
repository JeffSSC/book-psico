<script lang="ts">
	import { bookStore } from '../../stores/bookStore.svelte';
	import type { PositionedHitRegion } from './hitProjection';

	/**
	 * Transparent DOM layer that floats over the 3D book.
	 *
	 * The visible page content is baked into the WebGL texture; this layer only
	 * carries the real focusable buttons, projected onto the single reading
	 * page so native accessibility and hit testing keep working.
	 */

	let {
		regions,
		interactive = true
	}: {
		regions: PositionedHitRegion[];
		interactive?: boolean;
	} = $props();

	function activate(region: PositionedHitRegion) {
		if (!interactive) return;

		if (region.id === 'nav-prev') {
			bookStore.prevPage();
			return;
		}
		if (region.id === 'nav-next') {
			bookStore.nextPage();
			return;
		}
		if (region.id === 'close-book') {
			bookStore.closeBook();
			return;
		}
		if (region.id.startsWith('index:')) {
			bookStore.goToPage(Number.parseInt(region.id.slice(6), 10) - 1);
			return;
		}
		if (region.id.startsWith('option:')) {
			bookStore.selectOption(region.id.slice(7));
		}
	}

	function handleEnter(region: PositionedHitRegion) {
		if (interactive) bookStore.setHoverRegion(region.id);
	}

	function handleLeave(region: PositionedHitRegion) {
		if (bookStore.hoverRegionId === region.id) bookStore.setHoverRegion(null);
	}
</script>

<div
	class="pointer-events-none absolute inset-0 overflow-hidden"
	aria-hidden={interactive ? undefined : 'true'}
>
	{#each regions as region (region.id)}
		<button
			type="button"
			class="page-hit"
			style:left="{region.left}px"
			style:top="{region.top}px"
			style:width="{region.width}px"
			style:height="{region.height}px"
			onclick={() => activate(region)}
			onpointerenter={() => handleEnter(region)}
			onpointerleave={() => handleLeave(region)}
			onfocus={() => handleEnter(region)}
			onblur={() => handleLeave(region)}
			aria-label={region.label}
			title={region.label}
			tabindex={interactive ? 0 : -1}
			disabled={!interactive}
		></button>
	{/each}
</div>

<style>
	.page-hit {
		position: absolute;
		margin: 0;
		padding: 0;
		border: 0;
		border-radius: 10px;
		background: transparent;
		cursor: pointer;
		pointer-events: auto;
		appearance: none;
	}

	.page-hit:disabled {
		cursor: default;
	}

	.page-hit:focus {
		outline: none;
	}

	.page-hit:focus-visible {
		outline: 3px solid rgb(180 83 9 / 75%);
		outline-offset: 2px;
	}
</style>
