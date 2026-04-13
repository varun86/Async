import { useMemo } from 'react';
import type { TeamExpertConfig, TeamRoleType, TeamSettings } from './agentSettingsTypes';
import type { UserModelEntry } from './modelCatalog';
import { useI18n } from './i18n';

type Props = {
	value: TeamSettings;
	onChange: (next: TeamSettings) => void;
	modelEntries: UserModelEntry[];
};

const ROLE_IDS: TeamRoleType[] = ['team_lead', 'frontend', 'backend', 'qa', 'reviewer', 'custom'];

function newRole(): TeamExpertConfig {
	const id =
		typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
			? crypto.randomUUID()
			: `team-${Date.now()}`;
	return {
		id,
		name: 'New Expert',
		roleType: 'custom',
		systemPrompt: 'You are a specialist engineer. Complete assigned tasks with clear output.',
		enabled: true,
		allowedTools: [],
	};
}

export function SettingsTeamPanel({ value, onChange, modelEntries }: Props) {
	const { t } = useI18n();
	const experts = value.experts ?? [];
	const restoreDefaults = () => {
		onChange({
			useDefaults: true,
			maxParallelExperts: 3,
			experts: [],
		});
	};
	const modelOptions = useMemo(
		() =>
			modelEntries.map((m) => ({
				id: m.id,
				label: m.displayName.trim() || m.requestName || m.id,
			})),
		[modelEntries]
	);

	const patchRole = (id: string, patch: Partial<TeamExpertConfig>) => {
		onChange({
			...value,
			experts: experts.map((role) => (role.id === id ? { ...role, ...patch } : role)),
		});
	};

	const removeRole = (id: string) => {
		onChange({
			...value,
			experts: experts.filter((role) => role.id !== id),
		});
	};

	return (
		<div className="ref-settings-panel">
			<p className="ref-settings-lead">{t('settings.team.lead')}</p>
			<div className="ref-settings-field">
				<label>
					<input
						type="checkbox"
						checked={value.useDefaults !== false}
						onChange={(e) => onChange({ ...value, useDefaults: e.target.checked })}
					/>{' '}
					{t('settings.team.useDefaults')}
				</label>
			</div>
			<div className="ref-settings-field">
				<span>{t('settings.team.maxParallel')}</span>
				<input
					type="number"
					min={1}
					max={8}
					value={value.maxParallelExperts ?? 3}
					onChange={(e) => onChange({ ...value, maxParallelExperts: Number.parseInt(e.target.value, 10) || 3 })}
				/>
			</div>
			<div className="ref-settings-field">
				<button
					type="button"
					className="ref-settings-add-model"
					onClick={() => onChange({ ...value, experts: [...experts, newRole()] })}
				>
					{t('settings.team.addRole')}
				</button>
				<button
					type="button"
					className="ref-settings-remove-model"
					onClick={restoreDefaults}
				>
					{t('settings.team.restoreDefaults')}
				</button>
			</div>
			{experts.length === 0 ? <p className="ref-settings-proxy-hint">{t('settings.team.empty')}</p> : null}
			<div className="ref-settings-team-roles">
				{experts.map((role) => (
					<div key={role.id} className="ref-settings-team-role-card">
						<div className="ref-settings-team-role-grid">
							<label className="ref-settings-field ref-settings-field--compact">
								<span>{t('settings.team.roleName')}</span>
								<input
									value={role.name}
									onChange={(e) => patchRole(role.id, { name: e.target.value })}
								/>
							</label>
							<label className="ref-settings-field ref-settings-field--compact">
								<span>{t('settings.team.roleType')}</span>
								<select
									value={role.roleType}
									onChange={(e) => patchRole(role.id, { roleType: e.target.value as TeamRoleType })}
								>
									{ROLE_IDS.map((item) => (
										<option key={item} value={item}>
											{t(`settings.team.role.${item}`)}
										</option>
									))}
								</select>
							</label>
							<label className="ref-settings-field ref-settings-field--compact">
								<span>{t('settings.team.model')}</span>
								<select
									value={role.preferredModelId ?? ''}
									onChange={(e) => patchRole(role.id, { preferredModelId: e.target.value || undefined })}
								>
									<option value="">—</option>
									{modelOptions.map((item) => (
										<option key={item.id} value={item.id}>
											{item.label}
										</option>
									))}
								</select>
							</label>
							<label className="ref-settings-field ref-settings-field--compact">
								<span>{t('settings.team.toolsCsv')}</span>
								<input
									value={(role.allowedTools ?? []).join(', ')}
									onChange={(e) =>
										patchRole(role.id, {
											allowedTools: e.target.value
												.split(',')
												.map((x) => x.trim())
												.filter(Boolean),
										})
									}
								/>
							</label>
						</div>
						<label className="ref-settings-field">
							<span>{t('settings.team.prompt')}</span>
							<textarea
								className="ref-settings-models-search"
								value={role.systemPrompt}
								onChange={(e) => patchRole(role.id, { systemPrompt: e.target.value })}
							/>
						</label>
						<button
							type="button"
							className="ref-settings-remove-model"
							onClick={() => removeRole(role.id)}
						>
							{t('settings.team.removeRole')}
						</button>
					</div>
				))}
			</div>
		</div>
	);
}
