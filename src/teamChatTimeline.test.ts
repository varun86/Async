import { describe, expect, it } from 'vitest';

import { createEmptyLiveAgentBlocks } from './liveAgentBlocks';
import {
	buildTeamLeaderTimeline,
	normalizeTeamLeaderText,
	shouldHideTeamPlanProposalSummary,
} from './teamChatTimeline';
import type { TeamPlanProposalState, TeamSessionState } from './hooks/useTeamSession';

function buildSession(overrides: Partial<TeamSessionState> = {}): TeamSessionState {
	return {
		phase: 'planning',
		tasks: [],
		originalUserRequest: '',
		leaderMessage: '',
		leaderWorkflow: null,
		planSummary: '',
		reviewSummary: '',
		reviewVerdict: null,
		preflightSummary: '',
		preflightVerdict: null,
		planProposal: null,
		selectedTaskId: null,
		reviewerTaskId: null,
		roleWorkflowByTaskId: {},
		updatedAt: 0,
		...overrides,
	};
}

function buildProposal(summary: string): TeamPlanProposalState {
	return {
		proposalId: 'proposal-1',
		summary,
		tasks: [],
		awaitingApproval: true,
	};
}

describe('teamChatTimeline', () => {
	it('keeps the finished leader kickoff above cards and treats a newer leader message as trailing content', () => {
		const session = buildSession({
			tasks: [
				{
					id: 'task-1',
					expertId: 'frontend',
					expertName: 'Frontend',
					roleType: 'frontend',
					description: 'Inspect chat timeline rendering',
					status: 'pending',
					dependencies: [],
					acceptanceCriteria: [],
					logs: [],
				},
			],
			leaderMessage: '我已经拿到结果，接下来给你汇总。',
			leaderWorkflow: {
				taskId: 'team-lead',
				expertId: 'lead',
				expertName: 'Leader',
				roleType: 'team_lead',
				roleKind: 'lead',
				streaming: '',
				streamingThinking: '',
				liveBlocks: createEmptyLiveAgentBlocks(),
				messages: [{ role: 'assistant', content: '我先安排前端同学检查聊天区时间线。' }],
				lastTurnUsage: null,
				awaitingReply: false,
				lastUpdatedAt: 0,
			},
		});

		const timeline = buildTeamLeaderTimeline(session, [{ role: 'user', content: '修一下 team 时间线' }]);

		expect(timeline.history).toEqual(['我先安排前端同学检查聊天区时间线。']);
		expect(timeline.current).toBe('我已经拿到结果，接下来给你汇总。');
		expect(timeline.placeCurrentAfterCards).toBe(true);
	});

	it('hides the duplicated leader terminal summary when the final assistant message already shows it', () => {
		const session = buildSession({
			phase: 'delivering',
			leaderMessage: '请先明确目标范围，再继续 team 分派。',
			leaderWorkflow: {
				taskId: 'team-lead',
				expertId: 'lead',
				expertName: 'Leader',
				roleType: 'team_lead',
				roleKind: 'lead',
				streaming: '',
				streamingThinking: '',
				liveBlocks: createEmptyLiveAgentBlocks(),
				messages: [{ role: 'assistant', content: '请先明确目标范围，再继续 team 分派。' }],
				lastTurnUsage: null,
				awaitingReply: false,
				lastUpdatedAt: 0,
			},
		});

		const timeline = buildTeamLeaderTimeline(session, [
			{ role: 'user', content: '优化一下项目' },
			{ role: 'assistant', content: '请先明确目标范围，再继续 team 分派。' },
		]);

		expect(timeline.history).toEqual([]);
		expect(timeline.current).toBe('');
	});

	it('normalizes proposal summaries and hides them when leader text already shows the same content', () => {
		const leaderTimeline = {
			history: ['请先明确你想优化的是性能、代码质量还是用户体验。'],
			current: '',
			placeCurrentAfterCards: true,
		};

		expect(
			shouldHideTeamPlanProposalSummary(
				buildProposal(
					'MODE: CLARIFY\n请先明确你想优化的是性能、代码质量还是用户体验。'
				),
				leaderTimeline
			)
		).toBe(true);
		expect(
			normalizeTeamLeaderText(
				'MODE: CLARIFY\n请先明确你想优化的是性能、代码质量还是用户体验。'
			)
		).toBe('请先明确你想优化的是性能、代码质量还是用户体验。');
	});
});
