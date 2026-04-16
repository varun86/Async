import { describe, expect, it } from 'vitest';
import { extractBrowserCaptureGuestBindingsFromState } from './browserCapture.js';

describe('extractBrowserCaptureGuestBindingsFromState', () => {
	it('keeps valid tab to guest bindings and drops invalid rows', () => {
		const bindings = extractBrowserCaptureGuestBindingsFromState({
			guestBindings: [
				{ tabId: 'tab-1', webContentsId: 101 },
				{ tabId: 'tab-2', webContentsId: 102 },
				{ tabId: 'tab-2', webContentsId: 103 },
				{ tabId: '', webContentsId: 104 },
				{ tabId: 'tab-5', webContentsId: 0 },
				null,
			],
		});

		expect(bindings).toEqual([
			{ tabId: 'tab-1', webContentsId: 101 },
			{ tabId: 'tab-2', webContentsId: 102 },
		]);
	});
});
