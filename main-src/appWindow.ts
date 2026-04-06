import { BrowserWindow, app, screen } from 'electron';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { THEME_CHROME } from './themeChrome.js';
import { bindWorkspaceRootToWebContents, onWebContentsDestroyed } from './workspace.js';
import { acquireWorkspaceFileIndexRef, ensureWorkspaceFileIndex, releaseWorkspaceFileIndexRef } from './workspaceFileIndex.js';

const isDev = !app.isPackaged;
const devUrl = process.env.VITE_DEV_SERVER_URL ?? 'http://127.0.0.1:5173';
const loadDistFlag =
	process.env.ASYNC_SHELL_LOAD_DIST === '1' || process.env.VOID_SHELL_LOAD_DIST === '1';
const openDevTools =
	process.env.ASYNC_SHELL_DEVTOOLS === '1' || process.env.VOID_SHELL_DEVTOOLS === '1';

let appIconPath: string | undefined;

export function configureAppWindowIcon(icon: string | undefined): void {
	appIconPath = icon;
}

export type AppWindowSurface = 'agent' | 'editor';

export function createAppWindow(opts?: {
	blank?: boolean;
	surface?: AppWindowSurface;
	initialWorkspace?: string | null;
}): void {
	const preloadPath = path.join(__dirname, 'preload.cjs');
	const primary = screen.getPrimaryDisplay();
	const wa = primary.workArea;
	const DEFAULT_WIN_W = 1920;
	const DEFAULT_WIN_H = 1080;
	const w = Math.max(800, Math.min(DEFAULT_WIN_W, wa.width));
	const h = Math.max(600, Math.min(DEFAULT_WIN_H, wa.height));
	const x = wa.x + Math.round((wa.width - w) / 2);
	const y = wa.y + Math.round((wa.height - h) / 2);

	const darkChrome = THEME_CHROME.dark;
	const titleBarOptions =
		process.platform === 'darwin'
			? { titleBarStyle: 'hiddenInset' as const }
			: process.platform === 'win32'
				? {
						titleBarStyle: 'hidden' as const,
						titleBarOverlay: { ...darkChrome.titleBarOverlay },
					}
				: {};

	const win = new BrowserWindow({
		x,
		y,
		width: w,
		height: h,
		minWidth: 800,
		minHeight: 600,
		backgroundColor: darkChrome.backgroundColor,
		...(appIconPath ? { icon: appIconPath } : {}),
		...titleBarOptions,
		webPreferences: {
			preload: preloadPath,
			contextIsolation: true,
			nodeIntegration: false,
			sandbox: false,
		},
		show: false,
	});

	const surface: AppWindowSurface = opts?.surface ?? 'agent';
	const initial = opts?.initialWorkspace?.trim();
	if (initial) {
		const resolvedInitial = path.resolve(initial);
		bindWorkspaceRootToWebContents(win.webContents, resolvedInitial);
		acquireWorkspaceFileIndexRef(resolvedInitial);
		void ensureWorkspaceFileIndex(resolvedInitial).catch(() => {});
	}

	onWebContentsDestroyed(win.webContents, (releasedRoot) => {
		if (releasedRoot) {
			releaseWorkspaceFileIndexRef(releasedRoot);
		}
	});

	const notifyLayout = () => {
		if (!win.isDestroyed()) {
			win.webContents.send('async-shell:layout');
		}
	};
	win.on('resize', notifyLayout);
	win.on('move', notifyLayout);

	win.once('ready-to-show', () => win.show());

	const htmlPath = path.join(__dirname, '..', 'dist', 'index.html');
	const useViteDevServer = isDev && !loadDistFlag;

	const params = new URLSearchParams();
	if (opts?.blank) {
		params.set('blank', '1');
	}
	params.set('surface', surface);
	const qs = params.toString();
	const urlSuffix = qs ? `?${qs}` : '';

	if (useViteDevServer) {
		void win.loadURL(devUrl + urlSuffix);
		if (openDevTools) {
			win.webContents.openDevTools({ mode: 'detach' });
		}
	} else {
		const fileUrl = pathToFileURL(htmlPath).href + urlSuffix;
		void win.loadURL(fileUrl);
	}
}
