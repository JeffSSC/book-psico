import * as THREE from 'three';

/**
 * Generates a rich walnut wood texture for the desk / study board.
 */
export function createWoodDeskTexture(): THREE.CanvasTexture {
	const canvas = document.createElement('canvas');
	canvas.width = 1024;
	canvas.height = 1024;
	const ctx = canvas.getContext('2d');

	if (!ctx) {
		return new THREE.CanvasTexture(canvas);
	}

	// Warm deep walnut base gradient
	const baseGradient = ctx.createLinearGradient(0, 0, 1024, 0);
	baseGradient.addColorStop(0, '#241810');
	baseGradient.addColorStop(0.3, '#2D1E15');
	baseGradient.addColorStop(0.7, '#241911');
	baseGradient.addColorStop(1, '#1E140D');
	ctx.fillStyle = baseGradient;
	ctx.fillRect(0, 0, 1024, 1024);

	// Longitudinal natural wood grain bands
	for (let x = 0; x < 1024; x += 3) {
		const alpha = 0.04 + Math.sin(x * 0.015) * 0.03 + Math.random() * 0.04;
		ctx.fillStyle = `rgba(180, 130, 90, ${alpha})`;
		ctx.fillRect(x, 0, 2 + Math.random() * 3, 1024);
	}

	// Subtle darker grain rings
	for (let i = 0; i < 60; i++) {
		const gx = (i * 18 + Math.sin(i) * 30) % 1024;
		ctx.fillStyle = 'rgba(15, 10, 6, 0.12)';
		ctx.fillRect(gx, 0, 1.5, 1024);
	}

	// Soft horizontal noise / matte sheen
	ctx.fillStyle = 'rgba(255, 255, 255, 0.015)';
	for (let j = 0; j < 12000; j++) {
		const rx = Math.random() * 1024;
		const ry = Math.random() * 1024;
		ctx.fillRect(rx, ry, 2, 1);
	}

	const texture = new THREE.CanvasTexture(canvas);
	texture.wrapS = THREE.RepeatWrapping;
	texture.wrapT = THREE.RepeatWrapping;
	texture.repeat.set(2, 2);
	texture.colorSpace = THREE.SRGBColorSpace;
	return texture;
}

/**
 * Generates an executive leather desk pad with stitched perimeter.
 */
export function createDeskPadTexture(): THREE.CanvasTexture {
	const canvas = document.createElement('canvas');
	canvas.width = 1024;
	canvas.height = 768;
	const ctx = canvas.getContext('2d');

	if (!ctx) {
		return new THREE.CanvasTexture(canvas);
	}

	// 1. Dark charcoal / espresso leather pad
	const padGrad = ctx.createRadialGradient(512, 384, 50, 512, 384, 600);
	padGrad.addColorStop(0, '#23262A');
	padGrad.addColorStop(0.8, '#1A1C1E');
	padGrad.addColorStop(1, '#141618');
	ctx.fillStyle = padGrad;
	ctx.fillRect(0, 0, 1024, 768);

	// 2. Leather fine grain stippling
	ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
	for (let i = 0; i < 20000; i++) {
		const lx = Math.random() * 1024;
		const ly = Math.random() * 768;
		ctx.fillRect(lx, ly, 1.2, 1.2);
	}

	// 3. Stitched perimeter border
	ctx.save();
	ctx.strokeStyle = '#B39150';
	ctx.lineWidth = 2.5;
	ctx.setLineDash([8, 6]);
	ctx.strokeRect(36, 36, 1024 - 72, 768 - 72);
	ctx.restore();

	// Inner embossed hairline
	ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
	ctx.lineWidth = 1.5;
	ctx.strokeRect(44, 44, 1024 - 88, 768 - 88);

	const texture = new THREE.CanvasTexture(canvas);
	texture.colorSpace = THREE.SRGBColorSpace;
	return texture;
}
