import { type CSSProperties, type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
	createEmptyBotIntegration,
	type BotComposerMode,
	type BotIntegrationConfig,
	type BotPlatform,
} from './botSettingsTypes';
import type { UserModelEntry } from './modelCatalog';
import { useI18n, type TFunction } from './i18n';
import { VoidSelect } from './VoidSelect';

type Props = {
	value: BotIntegrationConfig[];
	onChange: (next: BotIntegrationConfig[]) => void;
	modelEntries: UserModelEntry[];
};

type EditorMode = 'create' | 'edit';

const PLATFORM_META: Record<BotPlatform, { accent: string }> = {
	telegram: { accent: '#2aabee' },
	slack: { accent: '#e01e5a' },
	discord: { accent: '#5865f2' },
	feishu: { accent: '#00c2b8' },
};

const platformImageByPlatform: Record<BotPlatform, string> = {
	telegram: new URL('../resources/icons/telegram_icon.png', import.meta.url).href,
	slack: new URL('../resources/icons/slack_icon.png', import.meta.url).href,
	discord: new URL('../resources/icons/discord_icon.png', import.meta.url).href,
	feishu: new URL('../resources/icons/feishu_icon.png', import.meta.url).href,
};

function linesFromText(raw: string): string[] {
	return raw
		.split(/\r?\n/)
		.map((item) => item.trim())
		.filter(Boolean);
}

function textFromLines(lines: string[] | undefined): string {
	return (lines ?? []).join('\n');
}

function platformProxyValue(item: BotIntegrationConfig): string {
	switch (item.platform) {
		case 'telegram':
			return item.telegram?.proxyUrl ?? '';
		case 'slack':
			return item.slack?.proxyUrl ?? '';
		case 'discord':
			return item.discord?.proxyUrl ?? '';
		case 'feishu':
			return item.feishu?.proxyUrl ?? '';
		default:
			return '';
	}
}

function patchPlatformProxy(item: BotIntegrationConfig, proxyUrl: string): BotIntegrationConfig {
	switch (item.platform) {
		case 'telegram':
			return { ...item, telegram: { ...(item.telegram ?? {}), proxyUrl } };
		case 'slack':
			return { ...item, slack: { ...(item.slack ?? {}), proxyUrl } };
		case 'discord':
			return { ...item, discord: { ...(item.discord ?? {}), proxyUrl } };
		case 'feishu':
			return { ...item, feishu: { ...(item.feishu ?? {}), proxyUrl } };
		default:
			return item;
	}
}

function platformLabel(platform: BotPlatform, t: TFunction): string {
	return t(`settings.bots.platform.${platform}.label`);
}

function platformDescription(platform: BotPlatform, t: TFunction): string {
	return t(`settings.bots.platform.${platform}.description`);
}

function platformAddHint(platform: BotPlatform, t: TFunction): string {
	return t(`settings.bots.platform.${platform}.addHint`);
}

function platformTip(platform: BotPlatform, t: TFunction): string {
	return t(`settings.bots.platform.${platform}.tip`);
}

function modeOptions(t: TFunction): Array<{ value: BotComposerMode; label: string }> {
	return [
		{ value: 'agent', label: t('composer.mode.agent') },
		{ value: 'ask', label: t('composer.mode.ask') },
		{ value: 'plan', label: t('composer.mode.plan') },
		{ value: 'team', label: t('composer.mode.team') },
	];
}

function ensurePlatformShape(item: BotIntegrationConfig, platform: BotPlatform): BotIntegrationConfig {
	const next: BotIntegrationConfig = {
		...item,
		platform,
		allowedReplyChatIds: item.allowedReplyChatIds ?? [],
		allowedReplyUserIds: item.allowedReplyUserIds ?? [],
		telegram: item.telegram ?? { requireMentionInGroups: true, allowedChatIds: [] },
		slack: item.slack ?? { allowedChannelIds: [] },
		discord: item.discord ?? { allowedChannelIds: [], requireMentionInGuilds: true },
		feishu: item.feishu ?? { allowedChatIds: [] },
	};
	if (platform === 'telegram' && next.telegram?.requireMentionInGroups === undefined) {
		next.telegram = { ...(next.telegram ?? {}), requireMentionInGroups: true };
	}
	if (platform === 'discord' && next.discord?.requireMentionInGuilds === undefined) {
		next.discord = { ...(next.discord ?? {}), requireMentionInGuilds: true };
	}
	return next;
}

function cloneIntegration(item: BotIntegrationConfig): BotIntegrationConfig {
	return ensurePlatformShape(
		{
			...item,
			allowedReplyChatIds: [...(item.allowedReplyChatIds ?? [])],
			allowedReplyUserIds: [...(item.allowedReplyUserIds ?? [])],
			telegram: item.telegram ? { ...item.telegram, allowedChatIds: [...(item.telegram.allowedChatIds ?? [])] } : undefined,
			slack: item.slack ? { ...item.slack, allowedChannelIds: [...(item.slack.allowedChannelIds ?? [])] } : undefined,
			discord: item.discord ? { ...item.discord, allowedChannelIds: [...(item.discord.allowedChannelIds ?? [])] } : undefined,
			feishu: item.feishu ? { ...item.feishu, allowedChatIds: [...(item.feishu.allowedChatIds ?? [])] } : undefined,
		},
		item.platform
	);
}

function createBotForPlatform(platform: BotPlatform, t: TFunction): BotIntegrationConfig {
	return ensurePlatformShape(
		{
			...createEmptyBotIntegration(),
			platform,
			name: `${platformLabel(platform, t)} ${t('settings.nav.bots')}`,
			defaultMode: 'agent',
			enabled: true,
		},
		platform
	);
}

function countAllowedChats(item: BotIntegrationConfig): number {
	return item.allowedReplyChatIds?.length ?? 0;
}

function countAllowedUsers(item: BotIntegrationConfig): number {
	return item.allowedReplyUserIds?.length ?? 0;
}

function modelLabel(modelId: string | undefined, modelEntries: UserModelEntry[], t: TFunction): string {
	if (!modelId) {
		return t('settings.bots.option.notSet');
	}
	const entry = modelEntries.find((item) => item.id === modelId);
	return entry?.displayName.trim() || entry?.requestName || modelId;
}

function botCardSummary(item: BotIntegrationConfig, t: TFunction): { chats: string; users: string; prompt: string } {
	const chatCount = countAllowedChats(item);
	const userCount = countAllowedUsers(item);
	return {
		chats: chatCount > 0 ? t('settings.bots.summary.groupsScoped', { count: chatCount }) : t('settings.bots.summary.groupsAll'),
		users: userCount > 0 ? t('settings.bots.summary.usersScoped', { count: userCount }) : t('settings.bots.summary.usersAll'),
		prompt: item.systemPrompt?.trim()
			? t('settings.bots.summary.promptCustom')
			: t('settings.bots.summary.promptDefault'),
	};
}

function platformIcon(platform: BotPlatform): ReactNode {
	return (
		<img
			className="ref-settings-bot-platform-image"
			src={platformImageByPlatform[platform]}
			alt=""
			aria-hidden
			draggable={false}
		/>
	);
}

type BotEditorModalProps = {
	t: TFunction;
	mode: EditorMode;
	draft: BotIntegrationConfig;
	modelEntries: UserModelEntry[];
	onChangeDraft: (next: BotIntegrationConfig) => void;
	onClose: () => void;
	onSave: () => void;
};

function BotEditorModal(props: BotEditorModalProps) {
	const { t, mode, draft, modelEntries, onChangeDraft, onClose, onSave } = props;
	const firstInputRef = useRef<HTMLInputElement | null>(null);
	const modelOptions = useMemo(
		() =>
			[{ value: '', label: t('settings.bots.option.notSet') }].concat(
				modelEntries.map((item) => ({
					value: item.id,
					label: item.displayName.trim() || item.requestName || item.id,
				}))
			),
		[modelEntries, t]
	);
	const meta = PLATFORM_META[draft.platform];

	useEffect(() => {
		const timer = window.setTimeout(() => firstInputRef.current?.focus(), 40);
		return () => {
			window.clearTimeout(timer);
		};
	}, []);

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				event.preventDefault();
				onClose();
			}
		};
		window.addEventListener('keydown', onKeyDown);
		return () => {
			window.removeEventListener('keydown', onKeyDown);
		};
	}, [onClose]);

	const patchDraft = (patch: Partial<BotIntegrationConfig>) => onChangeDraft({ ...draft, ...patch });

	const modal = (
		<div className="ref-settings-bot-modal-backdrop" role="presentation" onClick={onClose}>
			<div
				className="ref-settings-bot-modal"
				role="dialog"
				aria-modal="true"
				aria-label={mode === 'create' ? t('settings.bots.modal.create') : t('settings.bots.modal.edit')}
				onClick={(event) => event.stopPropagation()}
				style={{ '--bot-accent': meta.accent } as CSSProperties}
			>
				<div className="ref-settings-bot-modal-head">
					<div className="ref-settings-bot-modal-head-main">
						<div className="ref-settings-bot-modal-mark">{platformIcon(draft.platform)}</div>
						<div>
							<div className="ref-settings-bot-modal-kicker">
								{mode === 'create' ? t('settings.bots.modal.create') : t('settings.bots.modal.edit')}
							</div>
							<h3 className="ref-settings-bot-modal-title">
								{draft.name.trim() || `${platformLabel(draft.platform, t)} ${t('settings.nav.bots')}`}
							</h3>
							<p className="ref-settings-bot-modal-subtitle">{platformDescription(draft.platform, t)}</p>
						</div>
					</div>
					<button type="button" className="ref-settings-bot-modal-close" onClick={onClose}>
						{t('settings.bots.modal.close')}
					</button>
				</div>

				<div className="ref-settings-bot-modal-body">
					<section className="ref-settings-bot-section">
						<div className="ref-settings-bots-section-head">
							<div>
								<div className="ref-settings-bots-section-kicker">{t('settings.bots.section.basics.kicker')}</div>
								<h5 className="ref-settings-bots-section-title">{t('settings.bots.section.basics.title')}</h5>
							</div>
							<p className="ref-settings-bots-section-copy">
								{t('settings.bots.section.basics.copy')}
							</p>
						</div>
						<div className="ref-settings-bot-grid ref-settings-bot-grid--runtime">
							<label className="ref-settings-field">
								<span>{t('settings.bots.field.name')}</span>
								<input
									ref={firstInputRef}
									type="text"
									value={draft.name}
									onChange={(event) => patchDraft({ name: event.target.value })}
									placeholder={t('settings.bots.placeholder.name')}
								/>
							</label>
							<label className="ref-settings-field">
								<span>{t('settings.bots.field.platform')}</span>
								<VoidSelect
									value={draft.platform}
									onChange={(next) => onChangeDraft(ensurePlatformShape(draft, next as BotPlatform))}
									options={(Object.keys(PLATFORM_META) as BotPlatform[]).map((platform) => ({
										value: platform,
										label: platformLabel(platform, t),
									}))}
									ariaLabel={t('settings.bots.field.platform')}
								/>
							</label>
							<label className="ref-settings-field">
								<span>{t('settings.bots.field.defaultModel')}</span>
								<VoidSelect
									value={draft.defaultModelId ?? ''}
									onChange={(next) => patchDraft({ defaultModelId: String(next ?? '') })}
									options={modelOptions}
									ariaLabel={t('settings.bots.field.defaultModel')}
								/>
							</label>
							<label className="ref-settings-field">
								<span>{t('settings.bots.field.defaultMode')}</span>
								<VoidSelect
									value={draft.defaultMode ?? 'agent'}
									onChange={(next) => patchDraft({ defaultMode: next as BotComposerMode })}
									options={modeOptions(t)}
									ariaLabel={t('settings.bots.field.defaultMode')}
								/>
							</label>
						</div>
					</section>

					<section className="ref-settings-bot-section">
						<div className="ref-settings-bots-section-head">
							<div>
								<div className="ref-settings-bots-section-kicker">{t('settings.bots.section.reply.kicker')}</div>
								<h5 className="ref-settings-bots-section-title">{t('settings.bots.section.reply.title')}</h5>
							</div>
							<p className="ref-settings-bots-section-copy">{t('settings.bots.section.reply.copy')}</p>
						</div>
						<div className="ref-settings-bot-grid">
							<label className="ref-settings-field">
								<span>{t('settings.bots.field.allowedChats')}</span>
								<textarea
									value={textFromLines(draft.allowedReplyChatIds)}
									onChange={(event) => patchDraft({ allowedReplyChatIds: linesFromText(event.target.value) })}
									placeholder={
										draft.platform === 'discord' || draft.platform === 'slack'
											? t('settings.bots.placeholder.allowedChatChannel')
											: t('settings.bots.placeholder.allowedChatGroup')
									}
								/>
								<p className="ref-settings-field-hint">
									{draft.platform === 'discord' || draft.platform === 'slack'
										? t('settings.bots.hint.allowedChatChannel')
										: t('settings.bots.hint.allowedChatGroup')}
								</p>
							</label>
							<label className="ref-settings-field">
								<span>{t('settings.bots.field.allowedUsers')}</span>
								<textarea
									value={textFromLines(draft.allowedReplyUserIds)}
									onChange={(event) => patchDraft({ allowedReplyUserIds: linesFromText(event.target.value) })}
									placeholder={t('settings.bots.placeholder.allowedUsers')}
								/>
								<p className="ref-settings-field-hint">{t('settings.bots.hint.allowedUsers')}</p>
							</label>
						</div>
					</section>

					<section className="ref-settings-bot-section">
						<div className="ref-settings-bots-section-head">
							<div>
								<div className="ref-settings-bots-section-kicker">{platformLabel(draft.platform, t)}</div>
								<h5 className="ref-settings-bots-section-title">{t('settings.bots.section.connection.title')}</h5>
							</div>
							<p className="ref-settings-bots-section-copy">{platformTip(draft.platform, t)}</p>
						</div>

						{draft.platform === 'telegram' ? (
							<div className="ref-settings-bot-platform-stack">
								<label className="ref-settings-field">
									<span>{t('settings.bots.field.botToken')}</span>
									<input
										type="password"
										value={draft.telegram?.botToken ?? ''}
										onChange={(event) =>
											onChangeDraft({
												...draft,
												telegram: { ...(draft.telegram ?? {}), botToken: event.target.value },
											})
										}
										placeholder="123456:ABC..."
									/>
								</label>
								<div className="ref-settings-bot-preference-card">
									<div className="ref-settings-bot-preference-copy">
										<strong>{t('settings.bots.telegram.policy.title')}</strong>
										<p>{t('settings.bots.telegram.policy.desc')}</p>
									</div>
									<div className="ref-settings-bot-segment">
										<button
											type="button"
											className={`ref-settings-bot-segment-btn ${draft.telegram?.requireMentionInGroups !== false ? 'is-active' : ''}`}
											onClick={() =>
												onChangeDraft({
													...draft,
													telegram: { ...(draft.telegram ?? {}), requireMentionInGroups: true },
												})
											}
										>
											<span>{t('settings.bots.telegram.policy.mentionOnly')}</span>
											<small>{t('settings.bots.telegram.policy.mentionOnlyHint')}</small>
										</button>
										<button
											type="button"
											className={`ref-settings-bot-segment-btn ${draft.telegram?.requireMentionInGroups === false ? 'is-active' : ''}`}
											onClick={() =>
												onChangeDraft({
													...draft,
													telegram: { ...(draft.telegram ?? {}), requireMentionInGroups: false },
												})
											}
										>
											<span>{t('settings.bots.telegram.policy.direct')}</span>
											<small>{t('settings.bots.telegram.policy.directHint')}</small>
										</button>
									</div>
								</div>
							</div>
						) : null}

						{draft.platform === 'slack' ? (
							<div className="ref-settings-bot-grid">
								<label className="ref-settings-field">
									<span>{t('settings.bots.field.botToken')}</span>
									<input
										type="password"
										value={draft.slack?.botToken ?? ''}
										onChange={(event) =>
											onChangeDraft({
												...draft,
												slack: { ...(draft.slack ?? {}), botToken: event.target.value },
											})
										}
										placeholder="xoxb-..."
									/>
								</label>
								<label className="ref-settings-field">
									<span>{t('settings.bots.field.appToken')}</span>
									<input
										type="password"
										value={draft.slack?.appToken ?? ''}
										onChange={(event) =>
											onChangeDraft({
												...draft,
												slack: { ...(draft.slack ?? {}), appToken: event.target.value },
											})
										}
										placeholder="xapp-..."
									/>
								</label>
							</div>
						) : null}

						{draft.platform === 'discord' ? (
							<div className="ref-settings-bot-grid">
								<label className="ref-settings-field">
									<span>{t('settings.bots.field.botToken')}</span>
									<input
										type="password"
										value={draft.discord?.botToken ?? ''}
										onChange={(event) =>
											onChangeDraft({
												...draft,
												discord: { ...(draft.discord ?? {}), botToken: event.target.value },
											})
										}
										placeholder="Bot token"
									/>
								</label>
								<label className="ref-settings-bot-inline-check">
									<input
										type="checkbox"
										checked={draft.discord?.requireMentionInGuilds !== false}
										onChange={(event) =>
											onChangeDraft({
												...draft,
												discord: { ...(draft.discord ?? {}), requireMentionInGuilds: event.target.checked },
											})
										}
									/>
									<span>{t('settings.bots.discord.requireMention')}</span>
								</label>
							</div>
						) : null}

						{draft.platform === 'feishu' ? (
							<div className="ref-settings-bot-grid">
								<label className="ref-settings-field">
									<span>{t('settings.bots.field.appId')}</span>
									<input
										type="text"
										value={draft.feishu?.appId ?? ''}
										onChange={(event) =>
											onChangeDraft({
												...draft,
												feishu: { ...(draft.feishu ?? {}), appId: event.target.value },
											})
										}
									/>
								</label>
								<label className="ref-settings-field">
									<span>{t('settings.bots.field.appSecret')}</span>
									<input
										type="password"
										value={draft.feishu?.appSecret ?? ''}
										onChange={(event) =>
											onChangeDraft({
												...draft,
												feishu: { ...(draft.feishu ?? {}), appSecret: event.target.value },
											})
										}
									/>
								</label>
								<label className="ref-settings-field">
									<span>{t('settings.bots.field.encryptKey')}</span>
									<input
										type="password"
										value={draft.feishu?.encryptKey ?? ''}
										onChange={(event) =>
											onChangeDraft({
												...draft,
												feishu: { ...(draft.feishu ?? {}), encryptKey: event.target.value },
											})
										}
									/>
								</label>
								<label className="ref-settings-field">
									<span>{t('settings.bots.field.verificationToken')}</span>
									<input
										type="password"
										value={draft.feishu?.verificationToken ?? ''}
										onChange={(event) =>
											onChangeDraft({
												...draft,
												feishu: { ...(draft.feishu ?? {}), verificationToken: event.target.value },
											})
										}
									/>
								</label>
							</div>
						) : null}

						<label className="ref-settings-field">
							<span>{t('settings.bots.field.proxy')}</span>
							<input
								type="text"
								value={platformProxyValue(draft)}
								onChange={(event) => onChangeDraft(patchPlatformProxy(draft, event.target.value))}
								placeholder={t('settings.bots.placeholder.proxy')}
								autoComplete="off"
							/>
							<p className="ref-settings-field-hint">{t('settings.bots.hint.proxy')}</p>
						</label>
					</section>

					<section className="ref-settings-bot-section">
						<div className="ref-settings-bots-section-head">
							<div>
								<div className="ref-settings-bots-section-kicker">{t('settings.bots.section.persona.kicker')}</div>
								<h5 className="ref-settings-bots-section-title">{t('settings.bots.section.persona.title')}</h5>
							</div>
							<p className="ref-settings-bots-section-copy">{t('settings.bots.section.persona.copy')}</p>
						</div>
						<label className="ref-settings-field">
							<span>{t('settings.bots.field.systemPrompt')}</span>
							<textarea
								value={draft.systemPrompt ?? ''}
								onChange={(event) => patchDraft({ systemPrompt: event.target.value })}
								placeholder={t('settings.bots.placeholder.systemPrompt')}
							/>
						</label>
					</section>
				</div>

				<div className="ref-settings-bot-modal-foot">
					<button type="button" className="ref-settings-bot-modal-btn is-ghost" onClick={onClose}>
						{t('common.cancel')}
					</button>
					<button type="button" className="ref-settings-bot-modal-btn is-primary" onClick={onSave}>
						{mode === 'create' ? t('settings.bots.modal.createCta') : t('settings.bots.modal.saveCta')}
					</button>
				</div>
			</div>
		</div>
	);

	return typeof document !== 'undefined' ? createPortal(modal, document.body) : null;
}

export function SettingsBotsPanel({ value, onChange, modelEntries }: Props) {
	const { t } = useI18n();
	const [editorMode, setEditorMode] = useState<EditorMode | null>(null);
	const [draft, setDraft] = useState<BotIntegrationConfig | null>(null);

	const activeCount = value.filter((item) => item.enabled !== false).length;
	const restrictedCount = value.filter((item) => countAllowedChats(item) > 0).length;
	const whitelistedUsers = value.reduce((sum, item) => sum + countAllowedUsers(item), 0);

	const openCreate = (platform: BotPlatform) => {
		setEditorMode('create');
		setDraft(createBotForPlatform(platform, t));
	};

	const openEdit = (item: BotIntegrationConfig) => {
		setEditorMode('edit');
		setDraft(cloneIntegration(item));
	};

	const closeEditor = () => {
		setEditorMode(null);
		setDraft(null);
	};

	const saveEditor = () => {
		if (!draft || !editorMode) {
			return;
		}
		const next = cloneIntegration(draft);
		if (editorMode === 'create') {
			onChange([...value, next]);
		} else {
			onChange(value.map((item) => (item.id === next.id ? next : item)));
		}
		closeEditor();
	};

	const toggleEnabled = (id: string) => {
		onChange(value.map((item) => (item.id === id ? { ...item, enabled: item.enabled === false } : item)));
	};

	const removeOne = (id: string) => {
		onChange(value.filter((item) => item.id !== id));
		if (draft?.id === id) {
			closeEditor();
		}
	};

	return (
		<>
			<div className="ref-settings-panel ref-settings-panel--bots">
				<div className="ref-settings-bots-shell">
					<section className="ref-settings-bots-hero">
						<div>
							<div className="ref-settings-bots-kicker">{t('settings.bots.hero.kicker')}</div>
							<h3 className="ref-settings-bots-title">{t('settings.bots.hero.title')}</h3>
							<p className="ref-settings-bots-subtitle">{t('settings.bots.hero.subtitle')}</p>
						</div>
						<div className="ref-settings-bots-stats">
							<div className="ref-settings-bots-stat">
								<span className="ref-settings-bots-stat-label">{t('settings.bots.stats.configured')}</span>
								<strong>{value.length}</strong>
							</div>
							<div className="ref-settings-bots-stat">
								<span className="ref-settings-bots-stat-label">{t('settings.bots.stats.enabled')}</span>
								<strong>{activeCount}</strong>
							</div>
							<div className="ref-settings-bots-stat">
								<span className="ref-settings-bots-stat-label">{t('settings.bots.stats.groups')}</span>
								<strong>{restrictedCount}</strong>
							</div>
							<div className="ref-settings-bots-stat">
								<span className="ref-settings-bots-stat-label">{t('settings.bots.stats.users')}</span>
								<strong>{whitelistedUsers}</strong>
							</div>
						</div>
					</section>

					<section className="ref-settings-bots-add-section">
						<div className="ref-settings-bots-section-head">
							<div>
								<div className="ref-settings-bots-section-kicker">{t('settings.bots.quickStart.kicker')}</div>
								<h4 className="ref-settings-bots-section-title">{t('settings.bots.quickStart.title')}</h4>
							</div>
							<p className="ref-settings-bots-section-copy">{t('settings.bots.quickStart.copy')}</p>
						</div>
						<div className="ref-settings-bots-platform-grid">
							{(Object.keys(PLATFORM_META) as BotPlatform[]).map((platform) => {
								const meta = PLATFORM_META[platform];
								return (
									<button
										key={platform}
										type="button"
										className="ref-settings-bots-platform-card"
										style={{ '--bot-accent': meta.accent } as CSSProperties}
										onClick={() => openCreate(platform)}
									>
										<div className="ref-settings-bots-platform-icon">{platformIcon(platform)}</div>
										<div className="ref-settings-bots-platform-head">
											<strong>{platformLabel(platform, t)}</strong>
											<span>{platformAddHint(platform, t)}</span>
										</div>
									</button>
								);
							})}
						</div>
					</section>

					{value.length === 0 ? (
						<section className="ref-settings-bots-empty">
							<div
								className="ref-settings-bots-empty-ico"
								style={{ '--bot-accent': PLATFORM_META.telegram.accent } as CSSProperties}
							>
								{platformIcon('telegram')}
							</div>
							<div>
								<h4>{t('settings.bots.empty.title')}</h4>
								<p>{t('settings.bots.empty.body')}</p>
							</div>
						</section>
					) : null}

					<div className="ref-settings-bots-list">
						{value.map((item, index) => {
							const current = ensurePlatformShape(item, item.platform);
							const meta = PLATFORM_META[current.platform];
							const summary = botCardSummary(current, t);
							const modelText = modelLabel(current.defaultModelId, modelEntries, t);
							return (
								<article
									key={current.id}
									className={`ref-settings-bot-card ${current.enabled !== false ? 'is-enabled' : 'is-disabled'}`}
									style={{ '--bot-accent': meta.accent } as CSSProperties}
								>
									<div className="ref-settings-bot-card-head">
										<div className="ref-settings-bot-card-main">
											<div className="ref-settings-bot-card-mark">{platformIcon(current.platform)}</div>
										<div className="ref-settings-bot-card-copy">
											<div className="ref-settings-bot-card-kicker">
												{t('settings.bots.card.number', { count: index + 1 })} · {platformLabel(current.platform, t)}
											</div>
											<h4 className="ref-settings-bot-card-title">
												{current.name.trim() || `${platformLabel(current.platform, t)} ${t('settings.nav.bots')}`}
											</h4>
											<p className="ref-settings-bot-card-subtitle">
												{platformDescription(current.platform, t)}
											</p>
										</div>
									</div>
									<div className="ref-settings-bot-card-actions">
										<button
												type="button"
											className={`ref-settings-bot-chip-btn ${current.enabled !== false ? 'is-active' : ''}`}
											onClick={() => toggleEnabled(current.id)}
										>
											{current.enabled !== false ? t('settings.bots.action.enabled') : t('settings.bots.action.paused')}
										</button>
										<button
											type="button"
											className="ref-settings-bot-chip-btn"
											onClick={() => openEdit(current)}
										>
											{t('settings.bots.action.edit')}
										</button>
										<button
											type="button"
											className="ref-settings-bot-chip-btn is-danger"
											onClick={() => removeOne(current.id)}
										>
											{t('settings.bots.action.remove')}
										</button>
									</div>
								</div>

									<div className="ref-settings-bot-badges">
										<span className="ref-settings-bot-badge">{t(`composer.mode.${current.defaultMode ?? 'agent'}`)}</span>
										<span className="ref-settings-bot-badge">{modelText}</span>
										<span className="ref-settings-bot-badge">{summary.chats}</span>
										<span className="ref-settings-bot-badge">{summary.users}</span>
									</div>

									<div className="ref-settings-bot-overview">
									<div className="ref-settings-bot-overview-item">
										<span>{t('settings.bots.overview.groups')}</span>
										<strong>{summary.chats}</strong>
									</div>
									<div className="ref-settings-bot-overview-item">
										<span>{t('settings.bots.overview.users')}</span>
										<strong>{summary.users}</strong>
									</div>
									<div className="ref-settings-bot-overview-item">
										<span>{t('settings.bots.overview.prompt')}</span>
										<strong>{summary.prompt}</strong>
									</div>
								</div>
								</article>
							);
						})}
					</div>
				</div>
			</div>

			{draft && editorMode ? (
				<BotEditorModal
					t={t}
					mode={editorMode}
					draft={draft}
					modelEntries={modelEntries}
					onChangeDraft={setDraft}
					onClose={closeEditor}
					onSave={saveEditor}
				/>
			) : null}
		</>
	);
}
