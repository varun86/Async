import type { AgentToolDef, ToolCall, ToolResult } from './agentTools.js';

export type TeamPeerRequest = {
	targetExpertId: string;
	question: string;
};

type TeamPeerRequestRuntime = {
	onRequest: (payload: TeamPeerRequest) => Promise<string>;
};

const runtimes = new Map<string, TeamPeerRequestRuntime>();

export const teamRequestFromPeerTool: AgentToolDef = {
	name: 'team_request_from_peer',
	description:
		'Ask another specialist from the same Team session for information. MVP: only completed peer outputs are guaranteed.',
	parameters: {
		type: 'object',
		properties: {
			targetExpertId: {
				type: 'string',
				description: 'Target specialist assignment key or expert id.',
			},
			question: {
				type: 'string',
				description: 'Concrete question for the peer specialist.',
			},
		},
		required: ['targetExpertId', 'question'],
	},
};

export function setTeamPeerRequestRuntime(taskId: string, next: TeamPeerRequestRuntime | null): void {
	if (!taskId) {
		return;
	}
	if (next) {
		runtimes.set(taskId, next);
	} else {
		runtimes.delete(taskId);
	}
}

export function normalizeTeamPeerRequestArgs(
	raw: Record<string, unknown>
): { ok: true; request: TeamPeerRequest } | { ok: false; error: string } {
	const targetExpertId = String(raw.targetExpertId ?? '').trim();
	const question = String(raw.question ?? '').trim();
	if (!targetExpertId || !question) {
		return {
			ok: false,
			error: 'Error: team_request_from_peer requires both targetExpertId and question.',
		};
	}
	return {
		ok: true,
		request: {
			targetExpertId,
			question,
		},
	};
}

export async function executeTeamPeerRequestTool(
	call: ToolCall,
	teamTaskId?: string
): Promise<ToolResult> {
	const runtime = teamTaskId ? runtimes.get(teamTaskId) ?? null : null;
	if (!runtime) {
		return {
			toolCallId: call.id,
			name: call.name,
			content: 'team_request_from_peer is only available in Team specialist sessions.',
			isError: true,
		};
	}
	const normalized = normalizeTeamPeerRequestArgs(call.arguments);
	if (!normalized.ok) {
		return {
			toolCallId: call.id,
			name: call.name,
			content: normalized.error,
			isError: true,
		};
	}
	return {
		toolCallId: call.id,
		name: call.name,
		content: await runtime.onRequest(normalized.request),
		isError: false,
	};
}
