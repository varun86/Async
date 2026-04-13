import { describe, expect, it } from 'vitest';
import { buildReviewerTaskPacket, buildSpecialistTaskPacket, type TeamTask } from './teamOrchestrator.js';
import type { TeamExpertRuntimeProfile } from './teamExpertProfiles.js';

function makeExpert(
	id: string,
	name: string,
	roleType: TeamExpertRuntimeProfile['roleType']
): TeamExpertRuntimeProfile {
	return {
		id,
		name,
		roleType,
		assignmentKey: id,
		systemPrompt: `${name} prompt`,
	};
}

describe('buildSpecialistTaskPacket', () => {
	it('includes dependency handoffs instead of requiring the full transcript', () => {
		const expert = makeExpert('backend_worker', 'Backend Worker', 'backend');
		const dependency: TeamTask = {
			id: 'task-a',
			expertId: 'frontend_worker',
			expertAssignmentKey: 'frontend_worker',
			expertName: 'Frontend Worker',
			roleType: 'frontend',
			description: 'Implement the UI flow',
			status: 'completed',
			dependencies: [],
			acceptanceCriteria: ['UI compiles'],
			result: 'Updated the form fields and submit button states.',
		};
		const task: TeamTask = {
			id: 'task-b',
			expertId: expert.id,
			expertAssignmentKey: expert.assignmentKey,
			expertName: expert.name,
			roleType: expert.roleType,
			description: 'Wire the new API endpoint to the updated form.',
			status: 'pending',
			dependencies: [dependency.id],
			acceptanceCriteria: ['Request payload matches backend schema'],
		};

		const packet = buildSpecialistTaskPacket({
			task,
			expert,
			userRequest: 'Add a profile editor with autosave.',
			planSummary: 'Frontend updates the form first, then backend wires autosave support.',
			completedTasksById: new Map([[dependency.id, dependency]]),
		});

		expect(packet).toContain('focused assignment packet');
		expect(packet).toContain('## Original User Request');
		expect(packet).toContain('Add a profile editor with autosave.');
		expect(packet).toContain('## Dependency Handoffs');
		expect(packet).toContain('Frontend Worker');
		expect(packet).toContain('Updated the form fields and submit button states.');
		expect(packet).toContain('Request payload matches backend schema');
	});
});

describe('buildReviewerTaskPacket', () => {
	it('summarizes specialist outputs for review', () => {
		const reviewer = makeExpert('reviewer', 'Reviewer', 'reviewer');
		const completedTasks: TeamTask[] = [
			{
				id: 'task-a',
				expertId: 'writer',
				expertAssignmentKey: 'writer',
				expertName: 'Writer',
				roleType: 'custom',
				description: 'Document the new autosave behavior.',
				status: 'completed',
				dependencies: [],
				acceptanceCriteria: ['Docs mention failure recovery'],
				result: 'Added docs for autosave retries and offline recovery.',
			},
		];

		const packet = buildReviewerTaskPacket({
			reviewer,
			userRequest: 'Ship autosave and update the docs.',
			planSummary: 'Coder implements autosave, writer documents it, reviewer checks both.',
			completedTasks,
		});

		expect(packet).toContain('You are Reviewer, the reviewer for this team workflow.');
		expect(packet).toContain('## Specialist Outputs');
		expect(packet).toContain('Writer');
		expect(packet).toContain('Added docs for autosave retries and offline recovery.');
		expect(packet).toContain('### Verdict: APPROVED');
		expect(packet).toContain('### Verdict: NEEDS_REVISION');
	});
});
