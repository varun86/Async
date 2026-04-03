import { BrowserWindow } from 'electron';

/** Keep native window chrome aligned with renderer theme tokens. */
export const THEME_CHROME = {
	light: {
		backgroundColor: '#edf2f8',
		titleBarOverlay: {
			color: '#eef3f8',
			symbolColor: '#1e2936',
			height: 44,
		},
	},
	dark: {
		backgroundColor: '#10161b',
		titleBarOverlay: {
			color: '#141b22',
			symbolColor: '#d1dde1',
			height: 44,
		},
	},
} as const;

export type ThemeChromeScheme = keyof typeof THEME_CHROME;

export function applyThemeChromeToWindow(win: BrowserWindow, scheme: ThemeChromeScheme): void {
	const c = THEME_CHROME[scheme];
	if (win.isDestroyed()) {
		return;
	}
	win.setBackgroundColor(c.backgroundColor);
	if (process.platform === 'win32') {
		try {
			win.setTitleBarOverlay({ ...c.titleBarOverlay });
		} catch {
			/* ignore */
		}
	}
}

export function applyThemeChromeToAllWindows(scheme: ThemeChromeScheme): void {
	for (const win of BrowserWindow.getAllWindows()) {
		applyThemeChromeToWindow(win, scheme);
	}
}
