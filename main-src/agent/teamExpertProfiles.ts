import type { AgentToolDef } from './agentTools.js';
import type { TeamExpertConfig, TeamRoleType, TeamPresetId, TeamSettings } from '../settingsStore.js';
import { buildTeamPresetExperts, getTeamPreset, mergeBuiltinExpertsWithSaved } from '../../src/teamPresetCatalog.js';

export type TeamExpertRuntimeProfile = {
	id: string;
	roleType: TeamRoleType;
	assignmentKey: string;
	name: string;
	summary?: string;
	systemPrompt: string;
	preferredModelId?: string;
	allowedTools?: string[];
};

export type ResolvedTeamExpertProfiles = {
	experts: TeamExpertRuntimeProfile[];
	teamLead: TeamExpertRuntimeProfile | null;
	reviewer: TeamExpertRuntimeProfile | null;
	researcher: TeamExpertRuntimeProfile | null;
	specialists: TeamExpertRuntimeProfile[];
	planReviewer: TeamExpertRuntimeProfile | null;
	deliveryReviewer: TeamExpertRuntimeProfile | null;
};

function normalizeAllowedTools(allowed: string[] | undefined, baseTools: AgentToolDef[]): string[] | undefined {
	if (!Array.isArray(allowed) || allowed.length === 0) {
		return undefined;
	}
	const base = new Set(baseTools.map((t) => t.name));
	const unique = [...new Set(allowed.map((x) => String(x).trim()).filter(Boolean))];
	const filtered = unique.filter((name) => base.has(name));
	return filtered.length > 0 ? filtered : undefined;
}

export function defaultTeamExperts(presetId: TeamPresetId | undefined = 'engineering'): TeamExpertConfig[] {
	return buildTeamPresetExperts(presetId);
}

function toRuntimeProfile(
	item: TeamExpertConfig,
	baseTools: AgentToolDef[],
	summary?: string
): TeamExpertRuntimeProfile | null {
	const prompt = String(item.systemPrompt ?? '').trim();
	if (!prompt) {
		return null;
	}
	return {
		id: item.id,
		roleType: item.roleType ?? 'custom',
		assignmentKey:
			String(item.assignmentKey ?? '').trim() ||
			(item.roleType === 'custom'
				? String(item.name ?? '')
						.trim()
						.toLowerCase()
						.replace(/[^a-z0-9]+/g, '_')
						.replace(/^_+|_+$/g, '') || item.id
				: item.roleType ?? 'custom'),
		name: String(item.name ?? '').trim() || 'Specialist',
		summary,
		systemPrompt: prompt,
		preferredModelId: item.preferredModelId?.trim() || undefined,
		allowedTools: normalizeAllowedTools(item.allowedTools, baseTools),
	};
}

function resolveOptionalReviewer(
	reviewer: TeamExpertConfig | null | undefined,
	baseTools: AgentToolDef[]
): TeamExpertRuntimeProfile | null {
	if (!reviewer || reviewer.enabled === false) {
		return null;
	}
	return toRuntimeProfile(reviewer, baseTools) ?? null;
}

export function resolveTeamExpertProfiles(
	team: Pick<
		TeamSettings,
		| 'useDefaults'
		| 'experts'
		| 'presetId'
		| 'planReviewer'
		| 'deliveryReviewer'
	> | undefined,
	baseTools: AgentToolDef[]
): ResolvedTeamExpertProfiles {
	const preset = getTeamPreset(team?.presetId);
	const merged = mergeBuiltinExpertsWithSaved(team?.presetId, team?.useDefaults, team?.experts).filter(
		(x) => x && x.enabled !== false
	);
	const out: TeamExpertRuntimeProfile[] = [];
	for (const item of merged) {
		const runtime = toRuntimeProfile(item, baseTools, preset.experts.find((expert) => expert.id === item.id)?.summary);
		if (runtime) {
			out.push(runtime);
		}
	}
	const teamLead =
		out.find((expert) => expert.assignmentKey === 'team_lead') ??
		out.find((expert) => expert.roleType === 'team_lead') ??
		null;
	const reviewer =
		out.find((expert) => expert.assignmentKey === 'reviewer') ??
		out.find((expert) => expert.roleType === 'reviewer') ??
		null;
	const researcher = out.find((expert) => expert.assignmentKey === 'researcher') ?? null;
	const specialists = out.filter((expert) => expert.id !== teamLead?.id && expert.id !== reviewer?.id && expert.id !== researcher?.id);
	return {
		experts: out,
		teamLead,
		reviewer,
		researcher,
		specialists,
		planReviewer: resolveOptionalReviewer(team?.planReviewer, baseTools) ?? reviewer,
		deliveryReviewer: resolveOptionalReviewer(team?.deliveryReviewer, baseTools) ?? reviewer,
	};
}
