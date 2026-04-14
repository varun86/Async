import { memo } from 'react';
import type { TeamTask } from './hooks/useTeamSession';

type Props = {
	task: TeamTask;
	active: boolean;
	onSelect: () => void;
};

export const TeamExpertCard = memo(function TeamExpertCard({ task, active, onSelect }: Props) {
	const done = task.status === 'completed';
	const running = task.status === 'in_progress';
	const failed = task.status === 'failed';
	return (
		<button
			type="button"
			className={[
				'ref-team-expert-card',
				active && 'is-active',
				done && 'is-done',
				running && 'is-running',
				failed && 'is-failed',
			].filter(Boolean).join(' ')}
			onClick={onSelect}
			title={`${task.expertName}: ${task.description}`}
		>
			<span className={`ref-team-expert-avatar ref-team-expert-avatar--${task.roleType}`}>
				{task.expertName.slice(0, 1).toUpperCase()}
			</span>
			<span className="ref-team-expert-meta">
				<span className="ref-team-expert-name">{task.expertName}</span>
				<span className="ref-team-expert-task">{task.description}</span>
			</span>
			<span className={`ref-team-expert-status ref-team-expert-status--${task.status}`}>
				{running ? (
					<span className="ref-team-pulse" />
				) : null}
				{task.status}
			</span>
		</button>
	);
});

