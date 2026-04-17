import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { ToolResult } from './agentTools.js';
import type { ToolExecutionContext } from './toolExecutor.js';

const PERSIST_PREVIEW_CHARS = 4000;
const DEFAULT_THRESHOLD_CHARS = 100_000;
const BASH_THRESHOLD_CHARS = 30_000;
const SEARCH_THRESHOLD_CHARS = 20_000;

function sanitizePathPart(raw: string): string {
	return raw.replace(/[^a-zA-Z0-9_.-]+/g, '_').slice(0, 80) || 'item';
}

function persistenceThresholdForTool(name: string): number | null {
	if (name === 'Read') return null;
	if (name === 'Bash') return BASH_THRESHOLD_CHARS;
	if (name === 'Grep') return SEARCH_THRESHOLD_CHARS;
	if (name === 'Browser' || name === 'BrowserCapture') return BASH_THRESHOLD_CHARS;
	if (name.startsWith('mcp__')) return DEFAULT_THRESHOLD_CHARS;
	if (name === 'ReadMcpResourceTool' || name === 'ListMcpResourcesTool' || name === 'LSP') {
		return DEFAULT_THRESHOLD_CHARS;
	}
	return null;
}

function buildPersistenceTarget(execCtx: ToolExecutionContext, toolUseId: string, toolName: string): {
	fullPath: string;
	displayPath: string;
} {
	const fileName = `${sanitizePathPart(toolName)}-${sanitizePathPart(toolUseId)}.txt`;
	if (execCtx.workspaceRoot) {
		const threadPart = sanitizePathPart(execCtx.threadId ?? 'thread');
		const relPath = path.posix.join('.async', 'tool-results', threadPart, fileName);
		return {
			fullPath: path.join(execCtx.workspaceRoot, relPath.replace(/\//g, path.sep)),
			displayPath: relPath,
		};
	}
	const tmpPath = path.join(os.tmpdir(), 'async-tool-results', sanitizePathPart(execCtx.threadId ?? 'thread'), fileName);
	return {
		fullPath: tmpPath,
		displayPath: tmpPath,
	};
}

function buildPersistedPreviewMessage(
	toolName: string,
	displayPath: string,
	originalContent: string
): string {
	const preview =
		originalContent.length > PERSIST_PREVIEW_CHARS
			? `${originalContent.slice(0, PERSIST_PREVIEW_CHARS)}\n... (preview truncated)`
			: originalContent;
	return [
		'[Large tool result persisted]',
		`Tool: ${toolName}`,
		`Path: ${displayPath}`,
		`Original size: ${originalContent.length} chars`,
		'Preview:',
		preview,
	].join('\n');
}

export async function persistLargeToolResultIfNeeded(
	result: ToolResult,
	execCtx: ToolExecutionContext
): Promise<ToolResult> {
	const threshold = persistenceThresholdForTool(result.name);
	if (!Number.isFinite(threshold) || threshold === null || result.content.length <= threshold) {
		return result;
	}

	const target = buildPersistenceTarget(execCtx, result.toolCallId, result.name);
	try {
		await fs.promises.mkdir(path.dirname(target.fullPath), { recursive: true });
		await fs.promises.writeFile(target.fullPath, result.content, 'utf8');
		return {
			...result,
			content: buildPersistedPreviewMessage(result.name, target.displayPath, result.content),
		};
	} catch {
		const fallbackPreview =
			result.content.length > PERSIST_PREVIEW_CHARS
				? `${result.content.slice(0, PERSIST_PREVIEW_CHARS)}\n... (truncated after persistence fallback)`
				: result.content;
		return {
			...result,
			content: fallbackPreview,
		};
	}
}
