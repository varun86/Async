import { ipcMain, type WebContents } from 'electron';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import * as pty from 'node-pty';
import { getWorkspaceRoot } from './workspace.js';

type Session = { pty: pty.IPty; sender: WebContents };

const sessions = new Map<string, Session>();

function safeSend(sender: WebContents, channel: string, ...args: unknown[]) {
	if (!sender.isDestroyed()) {
		sender.send(channel, ...args);
	}
}

export function registerTerminalPtyIpc(): void {
	ipcMain.handle('terminal:ptyCreate', (event) => {
		const root = getWorkspaceRoot();
		const cwd = root && existsSync(root) ? root : process.cwd();
		const isWin = process.platform === 'win32';
		const shell = isWin ? process.env.ComSpec || 'cmd.exe' : process.env.SHELL || '/bin/bash';
		/** Windows：启动时切 UTF-8 代码页，避免终端内中文乱码。 */
		const args: string[] = isWin ? ['/k', 'chcp 65001>nul'] : ['-i'];
		const id = randomUUID();
		let proc: pty.IPty;
		try {
			proc = pty.spawn(shell, args, {
				name: 'xterm-256color',
				cwd,
				env: process.env as { [key: string]: string },
				cols: 80,
				rows: 24,
			});
		} catch (e) {
			return { ok: false as const, error: e instanceof Error ? e.message : String(e) };
		}
		proc.onData((data) => {
			safeSend(event.sender, 'terminal:ptyData', id, data);
		});
		proc.onExit(() => {
			sessions.delete(id);
			safeSend(event.sender, 'terminal:ptyExit', id, null);
		});
		sessions.set(id, { pty: proc, sender: event.sender });
		return { ok: true as const, id };
	});

	ipcMain.handle('terminal:ptyWrite', (event, id: unknown, data: unknown) => {
		if (typeof id !== 'string' || typeof data !== 'string') {
			return { ok: false as const };
		}
		const s = sessions.get(id);
		if (!s || s.sender !== event.sender) {
			return { ok: false as const };
		}
		try {
			s.pty.write(data);
			return { ok: true as const };
		} catch {
			return { ok: false as const };
		}
	});

	ipcMain.handle('terminal:ptyResize', (event, id: unknown, cols: unknown, rows: unknown) => {
		if (typeof id !== 'string' || typeof cols !== 'number' || typeof rows !== 'number') {
			return { ok: false as const };
		}
		const s = sessions.get(id);
		if (!s || s.sender !== event.sender) {
			return { ok: false as const };
		}
		try {
			const c = Math.max(2, Math.floor(cols));
			const r = Math.max(1, Math.floor(rows));
			s.pty.resize(c, r);
			return { ok: true as const };
		} catch {
			return { ok: false as const };
		}
	});

	ipcMain.handle('terminal:ptyKill', (event, id: unknown) => {
		if (typeof id !== 'string') {
			return { ok: false as const };
		}
		const s = sessions.get(id);
		if (!s || s.sender !== event.sender) {
			return { ok: false as const };
		}
		try {
			s.pty.kill();
		} catch {
			/* ignore */
		}
		sessions.delete(id);
		return { ok: true as const };
	});
}
