import { describe, expect, it } from 'vitest';

import {
	extractLatestPlanDraftFromAssistantContent,
	normalizePlanDraftSubmission,
	planDraftToMarkdown,
	planDraftToParsedPlan,
} from './planDraft';

describe('planDraft', () => {
	it('normalizes a structured plan draft submission', () => {
		const normalized = normalizePlanDraftSubmission({
			title: 'Fix Team Plan Flow',
			goal: 'Align planning flow around structured tool calls.',
			scopeContext: ['Team mode orchestration', 'Plan-mode prompt contract'],
			executionOverview: ['Migrate control flow first', 'Keep UI backward compatible'],
			implementationSteps: [
				{ title: 'Add tool', description: 'Create a structured plan submission tool.' },
			],
			todos: [{ content: 'Wire the tool into Plan mode' }],
			filesToChange: [{ path: 'src/foo.ts', action: 'Edit', description: 'Update the prompt path' }],
			risksAndEdgeCases: ['Old threads may still contain markdown plans'],
			openQuestions: ['Should we migrate old persisted plan files?'],
		});

		expect(normalized.ok).toBe(true);
		if (!normalized.ok) {
			return;
		}
		expect(normalized.draft.todos[0]?.id).toBe('todo-1');
		expect(normalized.draft.filesToChange[0]?.action).toBe('Edit');
	});

	it('converts a plan draft into parsed plan markdown', () => {
		const normalized = normalizePlanDraftSubmission({
			title: 'Fix Team Plan Flow',
			goal: 'Align planning flow around structured tool calls.',
			scopeContext: ['Team mode orchestration'],
			executionOverview: ['Migrate control flow first'],
			implementationSteps: [
				{ title: 'Add tool', description: 'Create a structured plan submission tool.' },
			],
			todos: [{ id: 'todo-a', content: 'Wire the tool into Plan mode', status: 'pending' }],
			filesToChange: [{ path: 'src/foo.ts', action: 'Edit', description: 'Update the prompt path' }],
			risksAndEdgeCases: ['Old threads may still contain markdown plans'],
			openQuestions: [],
		});
		expect(normalized.ok).toBe(true);
		if (!normalized.ok) {
			return;
		}

		const parsed = planDraftToParsedPlan(normalized.draft);
		expect(parsed.name).toBe('Fix Team Plan Flow');
		expect(parsed.overview).toBe('Align planning flow around structured tool calls.');
		expect(parsed.body).toContain('# Plan: Fix Team Plan Flow');
		expect(parsed.body).toContain('## Files to Change');
		expect(planDraftToMarkdown(normalized.draft)).toContain('Wire the tool into Plan mode');
	});

	it('extracts the latest structured plan draft from assistant content', () => {
		const content = JSON.stringify({
			_asyncAssistant: 1,
			v: 1,
			parts: [
				{ type: 'text', text: 'I drafted the plan.' },
				{
					type: 'tool',
					toolUseId: 'plan-1',
					name: 'plan_submit_draft',
					args: {
						title: 'Fix Team Plan Flow',
						goal: 'Align planning flow around structured tool calls.',
						scopeContext: ['Team mode orchestration'],
						executionOverview: ['Migrate control flow first'],
						implementationSteps: [
							{ title: 'Add tool', description: 'Create a structured plan submission tool.' },
						],
						todos: [{ content: 'Wire the tool into Plan mode' }],
						filesToChange: [],
						risksAndEdgeCases: [],
						openQuestions: [],
					},
					result: 'Plan draft recorded.',
					success: true,
				},
			],
		});

		const extracted = extractLatestPlanDraftFromAssistantContent(content);
		expect(extracted?.title).toBe('Fix Team Plan Flow');
		expect(extracted?.implementationSteps).toHaveLength(1);
	});
});
