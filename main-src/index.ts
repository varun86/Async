import { app, BrowserWindow, screen } from 'electron';
import path from 'node:path';
import { initSettingsStore, getRestorableWorkspace } from './settingsStore.js';
import { ensureDefaultThread, initThreadStore } from './threadStore.js';
import { registerIpc } from './ipc/register.js';
import { setWorkspaceRoot } from './workspace.js';

const isDev = !app.isPackaged;
const devUrl = process.env.VITE_DEV_SERVER_URL ?? 'http://127.0.0.1:5173';

/** 设为 1 时始终从 dist 读页面（典型桌面发布 / `npm run desktop`），不连 Vite 开发服务器。 */
const loadDistFlag =
	process.env.ASYNC_SHELL_LOAD_DIST === '1' || process.env.VOID_SHELL_LOAD_DIST === '1';
/** 仅在连开发服务器时可选打开开发者工具（默认关闭，避免像「浏览器调试页」）。 */
const openDevTools =
	process.env.ASYNC_SHELL_DEVTOOLS === '1' || process.env.VOID_SHELL_DEVTOOLS === '1';

function createWindow(): void {
	const preloadPath = path.join(__dirname, 'preload.cjs');
	const primary = screen.getPrimaryDisplay();
	const wa = primary.workArea;
	const w = Math.max(800, Math.round((wa.width * 2) / 3));
	const h = Math.max(600, Math.round((wa.height * 2) / 3));
	const x = wa.x + Math.round((wa.width - w) / 2);
	const y = wa.y + Math.round((wa.height - h) / 2);

	/** 去掉厚重系统标题栏，与 VS Code / Cursor 类应用一致；保留系统最小化/最大化/关闭（Windows 用 titleBarOverlay）。 */
	const titleBarOptions =
		process.platform === 'darwin'
			? { titleBarStyle: 'hiddenInset' as const }
			: process.platform === 'win32'
				? {
						titleBarStyle: 'hidden' as const,
						titleBarOverlay: {
							color: '#0c0c0e',
							symbolColor: '#d4d4d8',
							height: 32,
						},
					}
				: {};

	const win = new BrowserWindow({
		x,
		y,
		width: w,
		height: h,
		minWidth: 800,
		minHeight: 600,
		backgroundColor: '#0c0c0e',
		...titleBarOptions,
		webPreferences: {
			preload: preloadPath,
			contextIsolation: true,
			nodeIntegration: false,
			sandbox: false,
		},
		show: false,
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

	if (useViteDevServer) {
		void win.loadURL(devUrl);
		if (openDevTools) {
			win.webContents.openDevTools({ mode: 'detach' });
		}
	} else {
		void win.loadFile(htmlPath);
	}
}

app.whenReady().then(() => {
	const userData = app.getPath('userData');
	initSettingsStore(userData);
	const restored = getRestorableWorkspace();
	if (restored) {
		setWorkspaceRoot(restored);
	}
	initThreadStore(userData);
	ensureDefaultThread();
	registerIpc();
	createWindow();

	app.on('activate', () => {
		if (BrowserWindow.getAllWindows().length === 0) {
			createWindow();
		}
	});
});

app.on('window-all-closed', () => {
	if (process.platform !== 'darwin') {
		app.quit();
	}
});
