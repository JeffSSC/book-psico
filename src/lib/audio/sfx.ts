/**
 * The one sound of the HQ: a paper rustle, played with the Web Audio API
 * from a bundled mp3 sample (no network requests after it loads).
 */

import paperSfxUrl from './paper-sfx.mp3?url';

let audioCtx: AudioContext | null = null;
let paperBuffer: AudioBuffer | null = null;
let paperLoad: Promise<AudioBuffer | null> | null = null;

function getAudioContext(): AudioContext | null {
	if (typeof window === 'undefined') return null;
	if (!audioCtx) {
		const AudioContextClass =
			window.AudioContext ||
			(window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
		if (AudioContextClass) {
			audioCtx = new AudioContextClass();
		}
	}
	if (audioCtx && audioCtx.state === 'suspended') {
		audioCtx.resume().catch(() => {});
	}
	return audioCtx;
}

/**
 * Fetches and decodes paper-sfx.mp3 exactly once, caching the result.
 * Returns null if the sample cannot be loaded (callers then stay silent).
 */
function loadPaperBuffer(ctx: AudioContext): Promise<AudioBuffer | null> {
	if (paperBuffer) return Promise.resolve(paperBuffer);
	if (!paperLoad) {
		paperLoad = fetch(paperSfxUrl)
			.then((res) => {
				if (!res.ok) throw new Error(`paper-sfx.mp3 request failed: ${res.status}`);
				return res.arrayBuffer();
			})
			.then((data) => ctx.decodeAudioData(data))
			.then((buffer) => {
				paperBuffer = buffer;
				return buffer;
			})
			.catch(() => {
				paperLoad = null; // allow a retry on the next page turn
				return null;
			});
	}
	return paperLoad;
}

/**
 * Plays the cached paper sample with a short fade-in/out and a small
 * playback-rate variation so repeated flips never sound identical.
 */
function playPaperBuffer(ctx: AudioContext, direction: 'next' | 'prev', volume: number): void {
	if (!paperBuffer) return;

	const source = ctx.createBufferSource();
	source.buffer = paperBuffer;

	// Forward flips are slightly faster than backward flips, plus human jitter
	const jitter = (Math.random() - 0.5) * 0.08;
	source.playbackRate.value = (direction === 'next' ? 1 : 0.92) + jitter;

	const now = ctx.currentTime;
	const duration = paperBuffer.duration / source.playbackRate.value;

	const gainNode = ctx.createGain();
	gainNode.gain.setValueAtTime(0.0001, now);
	gainNode.gain.exponentialRampToValueAtTime(volume, now + 0.012);
	gainNode.gain.setValueAtTime(volume, now + Math.max(duration - 0.05, 0.02));
	gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration);

	source.connect(gainNode);
	gainNode.connect(ctx.destination);

	source.start(now);
	source.stop(now + duration + 0.02);
}

/**
 * Plays the recorded paper rustle from paper-sfx.mp3
 */
export function playPaperFlipSound(
	direction: 'next' | 'prev' = 'next',
	volume: number = 0.25
): void {
	try {
		const ctx = getAudioContext();
		if (!ctx) return;

		if (paperBuffer) {
			playPaperBuffer(ctx, direction, volume);
			return;
		}

		// First flip: decode the sample, then play it (a touch late, once)
		void loadPaperBuffer(ctx).then((buffer) => {
			if (buffer) playPaperBuffer(ctx, direction, volume);
		});
	} catch {
		// Audio may be blocked or uninitialized before user gesture
	}
}
