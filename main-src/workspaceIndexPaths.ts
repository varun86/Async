import * as path from 'node:path';

export function getWorkspaceIndexDir(root: string): string {
	return path.join(root, '.async', 'index');
}

export function getWorkspaceFilesIndexPath(root: string): string {
	return path.join(getWorkspaceIndexDir(root), 'files.json');
}

export function getWorkspaceSymbolsIndexPath(root: string): string {
	return path.join(getWorkspaceIndexDir(root), 'symbols.json');
}
