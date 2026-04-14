import type { AgentToolDef, ToolCall, ToolResult } from './agentTools.js';

export type TeamPeerReply = {
	requestId: string;
	answer: string;
};

type TeamPeerReplyRuntime = {
	onReply: (payload: TeamPeerReply) => void;
};

const runtimes = new Map<string, TeamPeerReplyRuntime>();

export const teamReplyToPeerTool: AgentToolDef = {
	name: 'team_reply_to_peer',
	description:
		'Reply to a pending peer collaboration request while you are still working on your task.',
	parameters: {
		type: 'object',
		properties: {
			requestId: {
				type: 'string',
				description: 'The request id from the peer mailbox prompt.',
			},
			answer: {
				type: 'string',
				description: 'A concise answer for the requesting teammate.',
			},
		},
		required: ['requestId', 'answer'],
	},
};

export function setTeamPeerReplyRuntime(taskId: string, next: TeamPeerReplyRuntime | null): void {
	if (!taskId) {
		return;
	}
	if (next) {
		runtimes.set(taskId, next);
	} else {
		runtimes.delete(taskId);
	}
}

export function normalizeTeamPeerReplyArgs(
	raw: Record<string, unknown>
): { ok: true; reply: TeamPeerReply } | { ok: false; error: string } {
	const requestId = String(raw.requestId ?? '').trim();
	const answer = String(raw.answer ?? '').trim();
	if (!requestId || !answer) {
		return {
			ok: false,
			error: 'Error: team_reply_to_peer requires both requestId and answer.',
		};
	}
	return {
		ok: true,
		reply: {
			requestId,
			answer,
		},
	};
}

export async function executeTeamReplyToPeerTool(
	call: ToolCall,
	teamTaskId?: string
): Promise<ToolResult> {
	const runtime = teamTaskId ? runtimes.get(teamTaskId) ?? null : null;
	if (!runtime) {
		return {
			toolCallId: call.id,
			name: call.name,
			content: 'team_reply_to_peer is only available for an active Team specialist task.',
			isError: true,
		};
	}
	const normalized = normalizeTeamPeerReplyArgs(call.arguments);
	if (!normalized.ok) {
		return {
			toolCallId: call.id,
			name: call.name,
			content: normalized.error,
			isError: true,
		};
	}
	runtime.onReply(normalized.reply);
	return {
		toolCallId: call.id,
		name: call.name,
		content: `Peer reply recorded for ${normalized.reply.requestId}.`,
		isError: false,
	};
}
