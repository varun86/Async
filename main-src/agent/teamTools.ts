import type { AgentToolDef } from './agentTools.js';

export const TEAM_ORCHESTRATOR_TOOLS: AgentToolDef[] = [
	{
		name: 'AssignTask',
		description:
			'Team Lead tool. Create a specialist task with explicit owner, dependencies, and acceptance criteria.',
		parameters: {
			type: 'object',
			properties: {
				expert: {
					type: 'string',
					description: 'Expert id or role to assign this task to.',
				},
				task: {
					type: 'string',
					description: 'Concrete task instruction for the assigned expert.',
				},
				dependencies: {
					type: 'array',
					items: { type: 'string' },
					description: 'Optional list of prerequisite task ids.',
				},
				acceptanceCriteria: {
					type: 'array',
					items: { type: 'string' },
					description: 'Optional success criteria checklist.',
				},
			},
			required: ['expert', 'task'],
		},
	},
	{
		name: 'ReviewResults',
		description:
			'Team Lead tool. Review one task result and mark approved or revision_needed.',
		parameters: {
			type: 'object',
			properties: {
				taskId: {
					type: 'string',
					description: 'Task id being reviewed.',
				},
				verdict: {
					type: 'string',
					enum: ['approved', 'revision_needed'],
					description: 'Review verdict for the task output.',
				},
				feedback: {
					type: 'string',
					description: 'Optional review summary or revision hints.',
				},
			},
			required: ['taskId', 'verdict'],
		},
	},
	{
		name: 'RequestUserInput',
		description:
			'Team Lead tool. Ask the user a blocking decision question when human input is required.',
		parameters: {
			type: 'object',
			properties: {
				question: {
					type: 'string',
					description: 'Question text for the user.',
				},
				options: {
					type: 'array',
					items: { type: 'string' },
					description: 'Optional answer options for quick selection.',
				},
			},
			required: ['question'],
		},
	},
	{
		name: 'TeamStatus',
		description:
			'Team Lead tool. Query aggregated progress for all tasks in this Team session.',
		parameters: {
			type: 'object',
			properties: {},
			required: [],
		},
	},
];
