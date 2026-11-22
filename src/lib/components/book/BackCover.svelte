<script lang="ts">
	import { bookUiCopy } from '../../data/uiCopy';

	/** The back board of the book, drawn in the night colours of the cover. */
</script>

<div class="back" role="img" aria-label={bookUiCopy.reader.backCoverLabel}></div>

<style>
	.back {
		position: absolute;
		inset: 0;
		background-color: #0a0f24;
		/* A low moon behind thin cloud, and the dark closing in at the edges. */
		background-image:
			radial-gradient(18% 13% at 50% 38%, rgba(255, 196, 96, 0.28), transparent 100%),
			radial-gradient(60% 45% at 50% 38%, rgba(60, 84, 170, 0.35), transparent 100%),
			radial-gradient(120% 90% at 50% 50%, transparent 55%, rgba(0, 0, 0, 0.55) 100%);
	}
</style>
