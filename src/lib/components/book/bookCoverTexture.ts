import * as THREE from 'three';
import type { BookMeta } from '../../types/book';

/**
 * Procedurally generates a high-resolution luxury hardcover texture with gold foil debossing.
 *
 * Every string it prints comes from `meta.cover`, so the cover carries no
 * book-specific copy of its own.
 */
export function createBookCoverTexture(meta: BookMeta): THREE.CanvasTexture {
	const canvas = document.createElement('canvas');
	canvas.width = 1024;
	canvas.height = 1440;
	const ctx = canvas.getContext('2d');

	if (!ctx) {
		const emptyTexture = new THREE.CanvasTexture(canvas);
		return emptyTexture;
	}

	// 1. Base dark linen / deep slate background
	const bgGradient = ctx.createLinearGradient(0, 0, 1024, 1440);
	bgGradient.addColorStop(0, '#1E2229');
	bgGradient.addColorStop(0.5, '#16191F');
	bgGradient.addColorStop(1, '#0F1216');
	ctx.fillStyle = bgGradient;
	ctx.fillRect(0, 0, 1024, 1440);

	// 2. Fine linen texture noise / subtle grain
	ctx.fillStyle = 'rgba(255, 255, 255, 0.025)';
	for (let i = 0; i < 28000; i++) {
		const x = Math.random() * 1024;
		const y = Math.random() * 1440;
		ctx.fillRect(x, y, 1.5, 1.5);
	}

	// 3. Elegant Gold Foil Outer Frame Border
	ctx.strokeStyle = '#D4AF37';
	ctx.lineWidth = 4;
	ctx.strokeRect(48, 48, 1024 - 96, 1440 - 96);

	// Inner delicate hairline border
	ctx.strokeStyle = 'rgba(212, 175, 55, 0.5)';
	ctx.lineWidth = 1.5;
	ctx.strokeRect(62, 62, 1024 - 124, 1440 - 124);

	// Corner ornamental accents
	const corners = [
		[48, 48],
		[1024 - 48, 48],
		[48, 1440 - 48],
		[1024 - 48, 1440 - 48]
	];
	ctx.fillStyle = '#D4AF37';
	corners.forEach(([cx, cy]) => {
		ctx.beginPath();
		ctx.arc(cx, cy, 5, 0, Math.PI * 2);
		ctx.fill();
	});

	// 4. Central Motif: Spotlight & Human Eye / Geometric Halo
	const centerX = 512;
	const centerY = 500;

	// Outer dashed halo
	ctx.save();
	ctx.strokeStyle = 'rgba(212, 175, 55, 0.35)';
	ctx.lineWidth = 2;
	ctx.setLineDash([8, 8]);
	ctx.beginPath();
	ctx.arc(centerX, centerY, 130, 0, Math.PI * 2);
	ctx.stroke();
	ctx.restore();

	// Solid gold circular badge
	ctx.strokeStyle = '#D4AF37';
	ctx.lineWidth = 3;
	ctx.beginPath();
	ctx.arc(centerX, centerY, 110, 0, Math.PI * 2);
	ctx.stroke();

	// Stylized Eye / Spotlight Icon in Gold
	ctx.save();
	ctx.strokeStyle = '#F3E5AB';
	ctx.lineWidth = 4.5;
	ctx.beginPath();
	// Upper eyelid curve
	ctx.moveTo(centerX - 65, centerY);
	ctx.quadraticCurveTo(centerX, centerY - 45, centerX + 65, centerY);
	// Lower eyelid curve
	ctx.quadraticCurveTo(centerX, centerY + 45, centerX - 65, centerY);
	ctx.stroke();

	// Iris circle
	ctx.fillStyle = '#D4AF37';
	ctx.beginPath();
	ctx.arc(centerX, centerY, 22, 0, Math.PI * 2);
	ctx.fill();

	// Pupil
	ctx.fillStyle = '#16191F';
	ctx.beginPath();
	ctx.arc(centerX, centerY, 10, 0, Math.PI * 2);
	ctx.fill();

	// Catchlight
	ctx.fillStyle = '#FFFFFF';
	ctx.beginPath();
	ctx.arc(centerX - 4, centerY - 4, 3.5, 0, Math.PI * 2);
	ctx.fill();
	ctx.restore();

	// Badge Ribbon Text
	ctx.font = '600 16px "Plus Jakarta Sans", sans-serif';
	ctx.fillStyle = 'rgba(212, 175, 55, 0.85)';
	ctx.textAlign = 'center';
	ctx.letterSpacing = '5px';
	ctx.fillText(meta.cover.badge, centerX, centerY + 160);

	// 5. Main Title
	ctx.font = '700 52px "Lora", Georgia, serif';
	ctx.fillStyle = '#FDFBF7';
	ctx.letterSpacing = '3px';
	ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
	ctx.shadowBlur = 10;
	ctx.shadowOffsetY = 4;
	// Title lines stack on a fixed leading so the block stays centred.
	meta.cover.titleLines.forEach((line, i) => {
		ctx.fillText(line, centerX, 810 + i * 65);
	});

	// Ornamental divider line with gold rhombus
	ctx.shadowColor = 'transparent';
	ctx.strokeStyle = '#D4AF37';
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.moveTo(centerX - 120, 930);
	ctx.lineTo(centerX + 120, 930);
	ctx.stroke();

	// Diamond ornament in divider
	ctx.fillStyle = '#D4AF37';
	ctx.beginPath();
	ctx.moveTo(centerX, 924);
	ctx.lineTo(centerX + 6, 930);
	ctx.lineTo(centerX, 936);
	ctx.lineTo(centerX - 6, 930);
	ctx.closePath();
	ctx.fill();

	// 6. Subtitle
	ctx.font = 'italic 400 22px "Lora", Georgia, serif';
	ctx.fillStyle = 'rgba(243, 229, 171, 0.9)';
	ctx.letterSpacing = '1px';
	meta.cover.subtitleLines.forEach((line, i) => {
		ctx.fillText(line, centerX, 990 + i * 35);
	});

	// 7. Author Credits & Foundation
	ctx.font = '600 18px "Plus Jakarta Sans", sans-serif';
	ctx.fillStyle = '#D4AF37';
	ctx.letterSpacing = '4px';
	ctx.fillText(meta.cover.credits, centerX, 1260);

	ctx.font = '400 13px "Plus Jakarta Sans", sans-serif';
	ctx.fillStyle = 'rgba(253, 251, 247, 0.5)';
	ctx.letterSpacing = '2px';
	ctx.fillText(meta.cover.edition, centerX, 1300);

	const texture = new THREE.CanvasTexture(canvas);
	texture.colorSpace = THREE.SRGBColorSpace;
	texture.anisotropy = 8;
	return texture;
}

/**
 * Creates realistic paper page block texture showing subtle horizontal page layers.
 */
export function createPageBlockTexture(): THREE.CanvasTexture {
	const canvas = document.createElement('canvas');
	canvas.width = 512;
	canvas.height = 128;
	const ctx = canvas.getContext('2d');

	if (!ctx) {
		return new THREE.CanvasTexture(canvas);
	}

	// Creamy paper tone base
	ctx.fillStyle = '#F5F1E6';
	ctx.fillRect(0, 0, 512, 128);

	// Fine horizontal page lines
	for (let y = 0; y < 128; y += 2) {
		const alpha = 0.08 + Math.random() * 0.12;
		ctx.fillStyle = `rgba(130, 115, 95, ${alpha})`;
		ctx.fillRect(0, y, 512, 1);
	}

	const texture = new THREE.CanvasTexture(canvas);
	texture.wrapS = THREE.RepeatWrapping;
	texture.wrapT = THREE.RepeatWrapping;
	texture.repeat.set(4, 1);
	return texture;
}
