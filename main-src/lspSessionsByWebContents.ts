import { BrowserWindow, type WebContents } from 'electron';
import { TsLspSession } from './lsp/tsLspSession.js';

const sessionsByWebContentsId = new Map<number, TsLspSession>();

export function getTsLspSessionForWebContents(wc: WebContents): TsLspSession {
	let s = sessionsByWebContentsId.get(wc.id);
	if (!s) {
		s = new TsLspSession();
		sessionsByWebContentsId.set(wc.id, s);
		const id = wc.id;
		wc.once('destroyed', () => {
			const cur = sessionsByWebContentsId.get(id);
			if (cur === s) {
				sessionsByWebContentsId.delete(id);
			}
			void s!.dispose().catch(() => {});
		});
	}
	return s;
}

export async function disposeTsLspSessionForWebContents(wc: WebContents): Promise<void> {
	const s = sessionsByWebContentsId.get(wc.id);
	if (s) {
		sessionsByWebContentsId.delete(wc.id);
		await s.dispose();
	}
}

/** 设置关闭 TS LSP 时清理所有窗口的语言服务子进程。 */
export async function disposeAllTsLspSessions(): Promise<void> {
	for (const win of BrowserWindow.getAllWindows()) {
		if (!win.isDestroyed()) {
			await disposeTsLspSessionForWebContents(win.webContents);
		}
	}
}
