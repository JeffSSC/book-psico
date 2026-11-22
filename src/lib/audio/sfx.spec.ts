import { describe, expect, it } from 'vitest';
import * as sfx from './sfx';

describe('sfx', () => {
	it('the paper flip is the only sound', () => {
		expect(Object.keys(sfx)).toEqual(['playPaperFlipSound']);
	});
});
