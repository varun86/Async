/**
 * Agent 工具池组装 — 对齐 Claude Code 的 assembleToolPool 思路：
 * 内置工具 +（仅 Agent 模式）动态 MCP 工具；按前缀 deny 过滤 MCP；同名以内置为准。
 */

import type { ComposerMode } from '../llm/composerMode.js';
import { agentToolsForComposerMode, type AgentToolDef } from './agentTools.js';
import { getMcpManager } from '../mcp/index.js';

/** 若工具名以任一前缀开头则剔除（前缀区分大小写，与 Claude deny 规则用法一致） */
export function filterMcpToolsByDenyPrefixes(
	tools: AgentToolDef[],
	denyPrefixes: string[] | undefined
): AgentToolDef[] {
	if (!denyPrefixes?.length) return tools;
	return tools.filter((t) => !denyPrefixes.some((p) => p.length > 0 && t.name.startsWith(p)));
}

/**
 * 合并内置工具与 MCP 动态工具。内置名称优先；MCP 仅挂在 `composerMode === 'agent'`。
 */
export function assembleAgentToolPool(
	composerMode: ComposerMode,
	options?: { mcpToolDenyPrefixes?: string[] }
): AgentToolDef[] {
	const modeForBase: 'agent' | 'plan' | 'team' = composerMode === 'plan' ? 'plan' : composerMode === 'team' ? 'team' : 'agent';
	const base = agentToolsForComposerMode(modeForBase);
	const baseNames = new Set(base.map((d) => d.name));

	if (composerMode !== 'agent' && composerMode !== 'team') {
		return base;
	}

	const mcpRaw = getMcpManager().getAgentTools();
	const mcpFiltered = filterMcpToolsByDenyPrefixes(mcpRaw, options?.mcpToolDenyPrefixes);
	const mcpNoBuiltinCollision = mcpFiltered
		.filter((t) => !baseNames.has(t.name))
		.sort((a, b) => a.name.localeCompare(b.name));

	// 内置顺序在前，与 Claude「built-ins 为前缀」一致；MCP 段按名排序以利缓存稳定
	return [...base, ...mcpNoBuiltinCollision];
}
