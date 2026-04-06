import * as path from 'node:path';

export const ENTRYPOINT_NAME = 'MEMORY.md';

export function getAutoMemPath(workspaceRoot?: string | null): string | null {
	const root = workspaceRoot ?? null;
	if (!root) {
		return null;
	}
	return path.join(root, '.async', 'memory') + path.sep;
}

export function getAutoMemEntrypoint(workspaceRoot?: string | null): string | null {
	const dir = getAutoMemPath(workspaceRoot);
	return dir ? path.join(dir, ENTRYPOINT_NAME) : null;
}

export function isAutoMemPath(filePath: string, workspaceRoot?: string | null): boolean {
	const dir = getAutoMemPath(workspaceRoot);
	if (!dir) {
		return false;
	}
	const normalizedPath = path.normalize(path.resolve(filePath));
	const normalizedDir = path.normalize(path.resolve(dir));
	if (normalizedPath === normalizedDir) {
		return true;
	}
	const rel = path.relative(normalizedDir, normalizedPath);
	return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
}
