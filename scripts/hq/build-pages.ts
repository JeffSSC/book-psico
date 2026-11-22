import { resolve } from 'node:path';
import { processAll } from './pipeline.ts';

/** Usage: pnpm hq:build [source folder with 1.png … N.png] */
const sourceDir = resolve(process.argv[2] ?? '../O parque dos mil olhos');

const manifest = await processAll({
	sourceDir,
	outDir: resolve('src/lib/assets/hq'),
	manifestPath: resolve('src/lib/data/hqManifest.json'),
	widths: [720, 1400]
});

for (const { page, width, height, color } of manifest) {
	console.log(`${String(page).padStart(2, '0')}  ${width}x${height}  ${color}`);
}
