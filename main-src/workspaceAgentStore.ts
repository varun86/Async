/**
 * 当前工作区下的 Agent 片段（Rules / Skills / Subagents），与全局 settings.json 分离。
 * 持久化路径：`<workspace>/.async/agent.json`
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { AgentCustomization, AgentRule, AgentSkill, AgentSubagent } from './agentSettingsTypes.js';

export type WorkspaceAgentProjectSlice = {
	rules?: AgentRule[];
	skills?: AgentSkill[];
	subagents?: AgentSubagent[];
};

const FILE_SEGMENTS = ['.async', 'agent.json'] as const;

export function workspaceAgentJsonPath(root: string): string {
	return path.join(root, ...FILE_SEGMENTS);
}

export function readWorkspaceAgentProjectSlice(root: string | null): WorkspaceAgentProjectSlice {
	if (!root) {
		return {};
	}
	const p = workspaceAgentJsonPath(root);
	try {
		if (!fs.existsSync(p) || !fs.statSync(p).isFile()) {
			return {};
		}
		const raw = fs.readFileSync(p, 'utf8');
		const parsed = JSON.parse(raw) as unknown;
		if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
			return {};
		}
		const o = parsed as Record<string, unknown>;
		return {
			rules: Array.isArray(o.rules) ? (o.rules as AgentRule[]) : [],
			skills: Array.isArray(o.skills) ? (o.skills as AgentSkill[]) : [],
			subagents: Array.isArray(o.subagents) ? (o.subagents as AgentSubagent[]) : [],
		};
	} catch {
		return {};
	}
}

export function writeWorkspaceAgentProjectSlice(root: string, slice: WorkspaceAgentProjectSlice): void {
	const p = workspaceAgentJsonPath(root);
	fs.mkdirSync(path.dirname(p), { recursive: true });
	const out: WorkspaceAgentProjectSlice = {
		rules: slice.rules ?? [],
		skills: slice.skills ?? [],
		subagents: slice.subagents ?? [],
	};
	fs.writeFileSync(p, JSON.stringify(out, null, 2), 'utf8');
}

/** 合并全局 agent 与当前仓库片段，供对话准备与注入使用 */
export function mergeAgentWithProjectSlice(
	userAgent: AgentCustomization | undefined,
	project: WorkspaceAgentProjectSlice
): AgentCustomization {
	const u = userAgent ?? {};
	return {
		...u,
		rules: [...(u.rules ?? []), ...(project.rules ?? [])],
		skills: [...(u.skills ?? []), ...(project.skills ?? [])],
		subagents: [...(u.subagents ?? []), ...(project.subagents ?? [])],
	};
}
