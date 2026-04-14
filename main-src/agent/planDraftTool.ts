import type { AgentToolDef, ToolCall, ToolResult } from './agentTools.js';
import {
	normalizePlanDraftSubmission,
	type PlanDraftSubmission,
} from '../../src/planDraft.js';

type PlanDraftRuntime = {
	onDraft: (draft: PlanDraftSubmission) => void;
};

const runtimes = new Map<string, PlanDraftRuntime>();

export const planSubmitDraftTool: AgentToolDef = {
	name: 'plan_submit_draft',
	description: 'Submit the structured plan draft. Must be called exactly once when the plan is ready.',
	parameters: {
		type: 'object',
		properties: {
			title: { type: 'string', description: 'Concise plan title.' },
			goal: { type: 'string', description: 'One or two sentence plan goal.' },
			scopeContext: {
				type: 'array',
				items: { type: 'string' },
				description: 'Key scope or context bullets.',
			},
			executionOverview: {
				type: 'array',
				items: { type: 'string' },
				description: 'High-level sequencing or milestone bullets.',
			},
			implementationSteps: {
				type: 'array',
				items: {
					type: 'object',
					properties: {
						title: { type: 'string' },
						description: { type: 'string' },
					},
					required: ['title', 'description'],
				},
				description: 'Ordered implementation steps.',
			},
			todos: {
				type: 'array',
				items: {
					type: 'object',
					properties: {
						id: { type: 'string' },
						content: { type: 'string' },
						status: { type: 'string', enum: ['pending', 'completed'] },
					},
					required: ['content'],
				},
				description: 'Checklist items for the plan.',
			},
			filesToChange: {
				type: 'array',
				items: {
					type: 'object',
					properties: {
						path: { type: 'string' },
						action: { type: 'string', enum: ['Edit', 'New', 'Delete'] },
						description: { type: 'string' },
					},
					required: ['path', 'action', 'description'],
				},
				description: 'Planned file changes.',
			},
			risksAndEdgeCases: {
				type: 'array',
				items: { type: 'string' },
				description: 'Important risks and edge cases.',
			},
			openQuestions: {
				type: 'array',
				items: { type: 'string' },
				description: 'Outstanding open questions.',
			},
		},
		required: ['title', 'goal', 'implementationSteps', 'todos'],
	},
};

export function setPlanDraftRuntime(threadId: string, next: PlanDraftRuntime | null): void {
	if (!threadId) {
		return;
	}
	if (next) {
		runtimes.set(threadId, next);
	} else {
		runtimes.delete(threadId);
	}
}

export async function executePlanSubmitDraftTool(
	call: ToolCall,
	threadId?: string | null
): Promise<ToolResult> {
	const runtime = threadId ? runtimes.get(threadId) ?? null : null;
	if (!runtime) {
		return {
			toolCallId: call.id,
			name: call.name,
			content: 'plan_submit_draft is only available during Plan mode sessions.',
			isError: true,
		};
	}
	const normalized = normalizePlanDraftSubmission(call.arguments);
	if (!normalized.ok) {
		return {
			toolCallId: call.id,
			name: call.name,
			content: normalized.error,
			isError: true,
		};
	}
	runtime.onDraft(normalized.draft);
	return {
		toolCallId: call.id,
		name: call.name,
		content: `Plan draft recorded: ${normalized.draft.title}.`,
		isError: false,
	};
}
