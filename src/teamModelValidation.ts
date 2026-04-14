import type { TeamExpertConfig, TeamSettings } from './agentSettingsTypes';
import type { UserModelEntry } from './modelCatalog';
import { mergeBuiltinExpertsWithSaved } from './teamPresetCatalog';

function activeTeamExperts(teamSettings: TeamSettings | undefined): TeamExpertConfig[] {
	const builtins = mergeBuiltinExpertsWithSaved(teamSettings?.presetId, teamSettings?.useDefaults, teamSettings?.experts);
	const extras = [teamSettings?.planReviewer, teamSettings?.deliveryReviewer].filter(
		(role): role is TeamExpertConfig => Boolean(role)
	);
	return [...builtins, ...extras].filter((role) => role.enabled !== false && role.systemPrompt.trim().length > 0);
}

export function findTeamRolesMissingModels(
	teamSettings: TeamSettings | undefined,
	modelEntries: UserModelEntry[]
): TeamExpertConfig[] {
	const validModelIds = new Set(modelEntries.map((entry) => entry.id));
	return activeTeamExperts(teamSettings).filter((role) => {
		const modelId = role.preferredModelId?.trim() ?? '';
		return !modelId || !validModelIds.has(modelId);
	});
}
