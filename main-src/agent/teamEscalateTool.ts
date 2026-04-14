import type { AgentToolDef, ToolCall, ToolResult } from './agentTools.js';

export type TeamEscalation = {
	reason: string;
	proposedChange: string;
	blockingEvidence: string[];
};

type TeamEscalationRuntime = {
	onEscalation: (payload: TeamEscalation) => void;
};

const runtimes = new Map<string, TeamEscalationRuntime>();

export const teamEscalateToLeadTool: AgentToolDef = {
	name: 'team_escalate_to_lead',
	description:
		'Pause the current specialist task and escalate a blocking issue back to the planner for replanning.',
	parameters: {
		type: 'object',
		properties: {
			reason: {
				type: 'string',
				description: 'Why the current task cannot continue safely.',
			},
			proposedChange: {
				type: 'string',
				description: 'Suggested adjustment for the planner to consider.',
			},
			blockingEvidence: {
				type: 'array',
				items: { type: 'string' },
				description: 'Concrete evidence such as file paths, missing symbols, or conflicting outputs.',
			},
		},
		required: ['reason', 'proposedChange'],
	},
};

export function setTeamEscalationRuntime(taskId: string, next: TeamEscalationRuntime | null): void {
	if (!taskId) {
		return;
	}
	if (next) {
		runtimes.set(taskId, next);
	} else {
		runtimes.delete(taskId);
	}
}

export function normalizeTeamEscalationArgs(
	raw: Record<string, unknown>
): { ok: true; escalation: TeamEscalation } | { ok: false; error: string } {
	const reason = String(raw.reason ?? '').trim();
	const proposedChange = String(raw.proposedChange ?? '').trim();
	if (!reason || !proposedChange) {
		return {
			ok: false,
			error: 'Error: team_escalate_to_lead requires both reason and proposedChange.',
		};
	}
	return {
		ok: true,
		escalation: {
			reason,
			proposedChange,
			blockingEvidence: Array.isArray(raw.blockingEvidence)
				? raw.blockingEvidence.map((value) => String(value ?? '').trim()).filter(Boolean)
				: [],
		},
	};
}

export async function executeTeamEscalateToLeadTool(
	call: ToolCall,
	teamTaskId?: string
): Promise<ToolResult> {
	const runtime = teamTaskId ? runtimes.get(teamTaskId) ?? null : null;
	if (!runtime) {
		return {
			toolCallId: call.id,
			name: call.name,
			content: 'team_escalate_to_lead is only available in Team specialist sessions.',
			isError: true,
		};
	}
	const normalized = normalizeTeamEscalationArgs(call.arguments);
	if (!normalized.ok) {
		return {
			toolCallId: call.id,
			name: call.name,
			content: normalized.error,
			isError: true,
		};
	}
	runtime.onEscalation(normalized.escalation);
	return {
		toolCallId: call.id,
		name: call.name,
		content: 'Escalation sent to the planner.',
		isError: false,
	};
}
