import type { TeamPlanProposalState, TeamSessionState } from './hooks/useTeamSession';
import type { ChatMessage } from './threadTypes';
import { extractTeamLeadNarrative } from './teamWorkflowText';

function normalizeLeaderText(text: string): string {
	return extractTeamLeadNarrative(text) || String(text ?? '').trim();
}

function dedupeConsecutive(items: string[]): string[] {
	const next: string[] = [];
	for (const item of items) {
		if (!item) {
			continue;
		}
		if (next[next.length - 1] === item) {
			continue;
		}
		next.push(item);
	}
	return next;
}

export type TeamLeaderTimeline = {
	history: string[];
	current: string;
	placeCurrentAfterCards: boolean;
};

export function buildTeamLeaderTimeline(
	session: TeamSessionState | null,
	displayMessages: ChatMessage[]
): TeamLeaderTimeline {
	if (!session) {
		return { history: [], current: '', placeCurrentAfterCards: false };
	}

	const lastAssistantContent =
		[...displayMessages].reverse().find((message) => message.role === 'assistant')?.content?.trim() || '';
	const hideTerminalDuplicate = session.phase === 'delivering' && session.tasks.length === 0;

	const rawHistory = (session.leaderWorkflow?.messages ?? [])
		.filter((message) => message.role === 'assistant')
		.map((message) => normalizeLeaderText(message.content))
		.filter(Boolean);
	const history = dedupeConsecutive(rawHistory).filter(
		(content) => !(hideTerminalDuplicate && content === lastAssistantContent)
	);

	const current = normalizeLeaderText(session.leaderMessage);
	const lastHistory = history[history.length - 1] ?? '';
	const currentIsDuplicate =
		(current.length > 0 && current === lastHistory) ||
		(hideTerminalDuplicate && current.length > 0 && current === lastAssistantContent);

	return {
		history,
		current: currentIsDuplicate ? '' : current,
		placeCurrentAfterCards: history.length > 0,
	};
}

export function shouldHideTeamPlanProposalSummary(
	proposal: TeamPlanProposalState | null,
	leaderTimeline: TeamLeaderTimeline
): boolean {
	if (!proposal) {
		return false;
	}
	const summary = normalizeLeaderText(proposal.summary);
	if (!summary) {
		return true;
	}
	const seenLeaderTexts = new Set([...leaderTimeline.history, leaderTimeline.current].filter(Boolean));
	return seenLeaderTexts.has(summary);
}

export function normalizeTeamLeaderText(text: string): string {
	return normalizeLeaderText(text);
}
