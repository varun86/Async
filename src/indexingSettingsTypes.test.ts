import { describe, expect, it } from 'vitest';
import { normalizeIndexingSettings } from './indexingSettingsTypes';

describe('normalizeIndexingSettings', () => {
	it('keeps only symbol index state', () => {
		expect(normalizeIndexingSettings()).toEqual({
			symbolIndexEnabled: true,
		});
	});

	it('respects explicit symbol toggle', () => {
		expect(normalizeIndexingSettings({ symbolIndexEnabled: true })).toEqual({
			symbolIndexEnabled: true,
		});
		expect(normalizeIndexingSettings({ symbolIndexEnabled: false })).toEqual({
			symbolIndexEnabled: false,
		});
	});
});
