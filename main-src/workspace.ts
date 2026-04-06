import type { WebContents } from 'electron';
import * as path from 'node:path';

/** 每个渲染进程 WebContents 独立的工作区根（绝对路径或「未打开」）。 */
const rootsByWebContentsId = new Map<number, string>();

/**
 * 绑定当前窗口的工作区根。返回该窗口此前绑定的根（若有），便于调用方做索引引用计数释放。
 */
export function bindWorkspaceRootToWebContents(webContents: WebContents, root: string | null): string | null {
	const id = webContents.id;
	const prev = rootsByWebContentsId.has(id) ? (rootsByWebContentsId.get(id) as string) : null;
	if (root) {
		rootsByWebContentsId.set(id, path.resolve(root));
	} else {
		rootsByWebContentsId.delete(id);
	}
	return prev;
}

export function getWorkspaceRootForWebContents(webContents: WebContents | null | undefined): string | null {
	if (!webContents || webContents.isDestroyed()) {
		return null;
	}
	return rootsByWebContentsId.get(webContents.id) ?? null;
}

export function clearWorkspaceBindingForWebContents(webContents: WebContents): string | null {
	const id = webContents.id;
	const prev = rootsByWebContentsId.has(id) ? (rootsByWebContentsId.get(id) as string) : null;
	rootsByWebContentsId.delete(id);
	return prev;
}

/** 在 WebContents 销毁时移除绑定，避免 id 复用串台。 */
export function onWebContentsDestroyed(webContents: WebContents, cb: (releasedRoot: string | null) => void): void {
	webContents.once('destroyed', () => {
		const prev = clearWorkspaceBindingForWebContents(webContents);
		cb(prev);
	});
}

/** Resolve user-supplied path (absolute or relative to workspace) and ensure it stays inside workspace. */
export function resolveWorkspacePath(userPath: string, workspaceRoot: string | null): string {
	if (!workspaceRoot) {
		throw new Error('No workspace folder open.');
	}
	const resolved = path.isAbsolute(userPath) ? path.resolve(userPath) : path.resolve(workspaceRoot, userPath);
	if (!isPathInsideRoot(resolved, workspaceRoot)) {
		throw new Error('Path escapes workspace.');
	}
	return resolved;
}

export function isPathInsideRoot(filePath: string, root: string): boolean {
	const a = path.normalize(filePath);
	const b = path.normalize(root);
	if (a === b) {
		return true;
	}
	const rel = path.relative(b, a);
	return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
}
