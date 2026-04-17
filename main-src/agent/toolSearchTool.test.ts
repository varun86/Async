import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AgentToolDef, ToolCall } from './agentTools.js';
import { executeToolSearchTool } from './toolSearchTool.js';
import { persistLargeToolResultIfNeeded } from './toolResultPersistence.js';

function tool(name: string, description: string): AgentToolDef {
	return {
		name,
		description,
		parameters: {
			type: 'object',
			properties: {
				input: { type: 'string', description: 'input text' },
			},
			required: ['input'],
		},
	};
}

const tempDirs: string[] = [];

afterEach(() => {
	for (const dir of tempDirs.splice(0, tempDirs.length)) {
		try {
			fs.rmSync(dir, { recursive: true, force: true });
		} catch {
			/* ignore */
		}
	}
});

describe('executeToolSearchTool', () => {
	it('loads matching deferred tools for the next turn', async () => {
		const discoverTools = vi.fn((names: string[]) => names);
		const call: ToolCall = {
			id: 'tool-1',
			name: 'ToolSearch',
			arguments: { query: 'github issues' },
		};

		const result = await executeToolSearchTool(call, {
			resolveFullToolPool: () => [
				tool('Read', 'read a file'),
				tool('mcp__github__issues', 'Search GitHub issues'),
				tool('mcp__postgres__query', 'Run SQL queries'),
			],
			discoverTools,
		});

		expect(result.isError).toBe(false);
		expect(discoverTools).toHaveBeenCalledWith(['mcp__github__issues']);
		const parsed = JSON.parse(result.content) as { loadedTools?: string[]; matches?: Array<{ name: string }> };
		expect(parsed.loadedTools).toEqual(['mcp__github__issues']);
		expect(parsed.matches?.map((item) => item.name)).toEqual(['mcp__github__issues']);
	});
});

describe('persistLargeToolResultIfNeeded', () => {
	it('persists oversized bash output and returns a preview payload', async () => {
		const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'async-tool-result-test-'));
		tempDirs.push(workspaceRoot);
		const result = await persistLargeToolResultIfNeeded(
			{
				toolCallId: 'tool-2',
				name: 'Bash',
				content: 'x'.repeat(35_000),
				isError: false,
			},
			{
				workspaceRoot,
				threadId: 'thread-1',
			}
		);

		expect(result.content).toContain('[Large tool result persisted]');
		expect(result.content).toContain('.async/tool-results/thread-1');
		const match = result.content.match(/Path:\s+(.+)/);
		expect(match?.[1]).toBeTruthy();
		const savedPath = match?.[1] ? path.join(workspaceRoot, match[1].replace(/\//g, path.sep)) : '';
		expect(fs.existsSync(savedPath)).toBe(true);
	});
});
