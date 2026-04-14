import type { AgentToolDef } from './agentTools.js';
import type { TeamExpertConfig, TeamRoleType, TeamPresetId } from '../settingsStore.js';
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

export function resolveTeamExpertProfiles(
	team: { useDefaults?: boolean; experts?: TeamExpertConfig[]; presetId?: TeamPresetId } | undefined,
	baseTools: AgentToolDef[]
): TeamExpertRuntimeProfile[] {
	const preset = getTeamPreset(team?.presetId);
	const merged = mergeBuiltinExpertsWithSaved(team?.presetId, team?.useDefaults, team?.experts).filter(
		(x) => x && x.enabled !== false
	);
	const out: TeamExpertRuntimeProfile[] = [];
	for (const item of merged) {
		const prompt = String(item.systemPrompt ?? '').trim();
		if (!prompt) {
			continue;
		}
		out.push({
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
			summary: preset.experts.find((expert) => expert.id === item.id)?.summary,
			systemPrompt: prompt,
			preferredModelId: item.preferredModelId?.trim() || undefined,
			allowedTools: normalizeAllowedTools(item.allowedTools, baseTools),
		});
	}
	return out;
}
