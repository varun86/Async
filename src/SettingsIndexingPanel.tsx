import { useCallback, useEffect, useMemo, useState } from 'react';
import { useI18n } from './i18n';
import type { AgentCustomization, AgentMemoryExtractionSettings } from './agentSettingsTypes';
import { defaultAgentCustomization } from './agentSettingsTypes';

type MemoryStats = {
	ok?: boolean;
	workspaceRoot?: string | null;
	memoryDir?: string | null;
	entrypointPath?: string | null;
	entrypointExists?: boolean;
	topicFiles?: number;
	entryCount?: number;
};

type ShellApi = NonNullable<Window['asyncShell']>;

type Props = {
	shell: ShellApi | null;
	workspaceOpen: boolean;
	/** 会话记忆抽取阈值写入 `agent.memoryExtraction` */
	agentCustomization: AgentCustomization;
	onChangeAgentCustomization: (next: AgentCustomization) => void;
};

export function SettingsIndexingPanel({
	shell,
	workspaceOpen,
	agentCustomization,
	onChangeAgentCustomization,
}: Props) {
	const { t } = useI18n();
	const av = useMemo(
		() => ({ ...defaultAgentCustomization(), ...agentCustomization }),
		[agentCustomization]
	);
	const patchAgent = useCallback(
		(p: Partial<AgentCustomization>) => {
			onChangeAgentCustomization({ ...av, ...p });
		},
		[av, onChangeAgentCustomization]
	);
	const [memoryStats, setMemoryStats] = useState<MemoryStats | null>(null);
	const [memoryLoading, setMemoryLoading] = useState(false);
	const [memoryRebuilding, setMemoryRebuilding] = useState(false);

	const refreshMemoryStats = useCallback(async () => {
		if (!shell || !workspaceOpen) {
			setMemoryStats(null);
			return;
		}
		setMemoryLoading(true);
		try {
			const r = (await shell.invoke('workspace:memory:stats')) as MemoryStats;
			setMemoryStats(r?.ok ? r : null);
		} catch {
			setMemoryStats(null);
		} finally {
			setMemoryLoading(false);
		}
	}, [shell, workspaceOpen]);

	useEffect(() => {
		void refreshMemoryStats();
	}, [refreshMemoryStats, workspaceOpen]);

	const runMemoryRebuild = async () => {
		if (!shell || !workspaceOpen) {
			return;
		}
		setMemoryRebuilding(true);
		try {
			await shell.invoke('workspace:memory:rebuild');
			await refreshMemoryStats();
		} finally {
			setMemoryRebuilding(false);
		}
	};

	const revealAbsolutePath = async (absPath: string | null | undefined) => {
		if (!shell || !absPath) {
			return;
		}
		await shell.invoke('shell:revealAbsolutePath', absPath);
	};

	return (
		<div className="ref-settings-panel ref-settings-panel--indexing">
			<p className="ref-settings-lead">{t('settings.indexing.lead')}</p>

			<h2 className="ref-settings-subhead" style={{ marginTop: 28 }}>
				{t('settings.indexing.memoryTitle')}
			</h2>
			<p className="ref-settings-proxy-hint">{t('settings.indexing.memoryLead')}</p>
			<div className="ref-settings-agent-card">
				<div className="ref-settings-agent-card-row">
					<div>
						<div className="ref-settings-agent-card-title">{t('settings.indexing.memoryLayoutTitle')}</div>
						<p className="ref-settings-agent-card-desc">{t('settings.indexing.memoryLayoutDesc')}</p>
					</div>
				</div>
				<div className="ref-settings-agent-card-row" style={{ marginTop: 12 }}>
					<div>
						<div className="ref-settings-agent-card-title">{t('settings.indexing.memoryAgentTitle')}</div>
						<p className="ref-settings-agent-card-desc">{t('settings.indexing.memoryAgentDesc')}</p>
					</div>
				</div>
			</div>
			<h2 className="ref-settings-subhead" style={{ marginTop: 24 }}>
				{t('settings.indexing.memoryStatsTitle')}
			</h2>
			<p className="ref-settings-proxy-hint">{t('settings.indexing.memoryStatsHint')}</p>
			<div className="ref-settings-indexing-stats">
				{!workspaceOpen ? (
					<p className="ref-settings-proxy-hint">{t('settings.indexing.noWorkspace')}</p>
				) : memoryLoading ? (
					<p className="ref-settings-proxy-hint">{t('settings.indexing.statsLoading')}</p>
				) : memoryStats ? (
					<ul className="ref-settings-indexing-stat-list">
						<li>
							{t('settings.indexing.memoryDir')}: <strong>{memoryStats.memoryDir ?? '—'}</strong>
						</li>
						<li>
							{t('settings.indexing.memoryEntrypoint')}: <strong>{memoryStats.entrypointPath ?? '—'}</strong>
						</li>
						<li>
							{t('settings.indexing.memoryTopicFiles')}: <strong>{memoryStats.topicFiles ?? 0}</strong>
						</li>
						<li>
							{t('settings.indexing.memoryIndexEntries')}: <strong>{memoryStats.entryCount ?? 0}</strong>
						</li>
					</ul>
				) : (
					<p className="ref-settings-proxy-hint">{t('settings.indexing.statsUnavailable')}</p>
				)}
			</div>
			<div className="ref-settings-indexing-actions">
				<button
					type="button"
					className="ref-settings-add-model"
					disabled={!shell || !workspaceOpen || memoryLoading || memoryRebuilding}
					onClick={() => void runMemoryRebuild()}
				>
					{memoryRebuilding ? t('settings.indexing.rebuilding') : t('settings.indexing.rebuildMemory')}
				</button>
				<button
					type="button"
					className="ref-settings-add-model"
					disabled={!shell || !workspaceOpen || memoryLoading || !memoryStats?.memoryDir}
					onClick={() => void revealAbsolutePath(memoryStats?.memoryDir)}
				>
					{t('settings.indexing.openMemoryDir')}
				</button>
				<button
					type="button"
					className="ref-settings-add-model"
					disabled={!shell || !workspaceOpen || memoryLoading || !memoryStats?.entrypointPath}
					onClick={() => void revealAbsolutePath(memoryStats?.entrypointPath)}
				>
					{t('settings.indexing.openMemoryEntrypoint')}
				</button>
				<button
					type="button"
					className="ref-settings-set-default"
					disabled={!shell || !workspaceOpen || memoryLoading || memoryRebuilding}
					onClick={() => void refreshMemoryStats()}
				>
					{t('settings.indexing.refreshMemoryStats')}
				</button>
			</div>

			<h2 className="ref-settings-subhead" style={{ marginTop: 28 }}>
				{t('agentBehavior.memoryExtractionTitle')}
			</h2>
			<p className="ref-settings-proxy-hint">{t('agentBehavior.memoryExtractionDesc')}</p>
			<div className="ref-settings-agent-card">
				<div className="ref-settings-agent-card-row">
					<div>
						<div className="ref-settings-agent-card-title">{t('agentBehavior.memoryExtractionEnabled')}</div>
					</div>
					<button
						type="button"
						className={`ref-settings-toggle ${av.memoryExtraction?.enabled !== false ? 'is-on' : ''}`}
						role="switch"
						aria-checked={av.memoryExtraction?.enabled !== false}
						onClick={() => {
							const cur: AgentMemoryExtractionSettings = { ...(av.memoryExtraction ?? {}) };
							const on = cur.enabled !== false;
							patchAgent({
								memoryExtraction: {
									...cur,
									enabled: on ? false : true,
								},
							});
						}}
					>
						<span className="ref-settings-toggle-knob" />
					</button>
				</div>
				<div className="ref-settings-agent-card-row" style={{ marginTop: 12, alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
					<label className="ref-settings-field ref-settings-field--compact">
						<span>{t('agentBehavior.memFirst')}</span>
						<input
							type="number"
							min={1}
							max={50}
							className="ref-settings-agent-number"
							disabled={av.memoryExtraction?.enabled === false}
							value={av.memoryExtraction?.minNonSystemMessagesBeforeFirst ?? 4}
							onChange={(e) => {
								const n = parseInt(e.target.value, 10);
								if (!Number.isFinite(n)) return;
								patchAgent({
									memoryExtraction: {
										...(av.memoryExtraction ?? {}),
										minNonSystemMessagesBeforeFirst: Math.min(50, Math.max(1, n)),
									},
								});
							}}
						/>
					</label>
					<label className="ref-settings-field ref-settings-field--compact">
						<span>{t('agentBehavior.memBetween')}</span>
						<input
							type="number"
							min={1}
							max={50}
							className="ref-settings-agent-number"
							disabled={av.memoryExtraction?.enabled === false}
							value={av.memoryExtraction?.minNonSystemMessagesBetween ?? 3}
							onChange={(e) => {
								const n = parseInt(e.target.value, 10);
								if (!Number.isFinite(n)) return;
								patchAgent({
									memoryExtraction: {
										...(av.memoryExtraction ?? {}),
										minNonSystemMessagesBetween: Math.min(50, Math.max(1, n)),
									},
								});
							}}
						/>
					</label>
					<label className="ref-settings-field ref-settings-field--compact">
						<span>{t('agentBehavior.memTools')}</span>
						<input
							type="number"
							min={0}
							max={50}
							className="ref-settings-agent-number"
							disabled={av.memoryExtraction?.enabled === false}
							value={av.memoryExtraction?.minToolCallsBetween ?? 3}
							onChange={(e) => {
								const n = parseInt(e.target.value, 10);
								if (!Number.isFinite(n)) return;
								patchAgent({
									memoryExtraction: {
										...(av.memoryExtraction ?? {}),
										minToolCallsBetween: Math.min(50, Math.max(0, n)),
									},
								});
							}}
						/>
					</label>
				</div>
			</div>
		</div>
	);
}
