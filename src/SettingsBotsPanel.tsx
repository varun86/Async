import { type CSSProperties, type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
	createEmptyBotIntegration,
	type BotComposerMode,
	type BotIntegrationConfig,
	type BotPlatform,
} from './botSettingsTypes';
import type { UserModelEntry } from './modelCatalog';
import { useI18n } from './i18n';
import { VoidSelect } from './VoidSelect';

type Props = {
	value: BotIntegrationConfig[];
	onChange: (next: BotIntegrationConfig[]) => void;
	modelEntries: UserModelEntry[];
};

type EditorMode = 'create' | 'edit';

type PlatformMeta = {
	labelZh: string;
	labelEn: string;
	accent: string;
	descriptionZh: string;
	descriptionEn: string;
	addHintZh: string;
	addHintEn: string;
	tipZh: string;
	tipEn: string;
};

const PLATFORM_META: Record<BotPlatform, PlatformMeta> = {
	telegram: {
		labelZh: 'Telegram',
		labelEn: 'Telegram',
		accent: '#2aabee',
		descriptionZh: '适合私聊、话题群和轻量自动化入口。',
		descriptionEn: 'A clean fit for direct chats, topic groups, and lightweight automation.',
		addHintZh: '适合开发群、个人助手和话题讨论。',
		addHintEn: 'Great for dev groups, personal assistants, and topic threads.',
		tipZh: '推荐在群聊中要求显式 @ 机器人，避免误触发。',
		tipEn: 'Requiring @mentions in groups helps avoid accidental triggers.',
	},
	slack: {
		labelZh: 'Slack',
		labelEn: 'Slack',
		accent: '#e01e5a',
		descriptionZh: '适合团队频道、线程回复和 Socket Mode 常驻 bot。',
		descriptionEn: 'Best for team channels, threaded replies, and Socket Mode bots.',
		addHintZh: '适合团队协作和工作流落地。',
		addHintEn: 'Ideal for team collaboration and workflow-heavy usage.',
		tipZh: '需要同时配置 Bot Token 和 App Token 才能建立 Socket Mode 连接。',
		tipEn: 'Both a Bot Token and an App Token are required for Socket Mode.',
	},
	discord: {
		labelZh: 'Discord',
		labelEn: 'Discord',
		accent: '#5865f2',
		descriptionZh: '适合频道式社区、讨论串和多人协作场景。',
		descriptionEn: 'A strong fit for channel-based communities and collaborative servers.',
		addHintZh: '适合社群、开源项目和多人频道。',
		addHintEn: 'Works well for communities, OSS projects, and shared channels.',
		tipZh: '建议开启“频道中必须提及机器人”，并在开发者后台打开消息相关 intents。',
		tipEn: 'Prefer requiring mentions in guilds, and enable message-related intents in the developer portal.',
	},
	feishu: {
		labelZh: '飞书',
		labelEn: 'Feishu',
		accent: '#00c2b8',
		descriptionZh: '适合企业内部协作、群聊问答和工作流辅助。',
		descriptionEn: 'Built for internal collaboration, group Q&A, and workflow assistance.',
		addHintZh: '适合公司内网、项目群和流程助手。',
		addHintEn: 'Great for internal teams, project groups, and process assistants.',
		tipZh: '当前实现走长连接事件订阅，自建应用需要正确配置 App ID / Secret。',
		tipEn: 'This implementation uses websocket event delivery, so your self-built app needs a valid App ID / Secret.',
	},
};

const MODE_OPTIONS: Array<{ value: BotComposerMode; label: string }> = [
	{ value: 'agent', label: 'Agent' },
	{ value: 'ask', label: 'Ask' },
	{ value: 'plan', label: 'Plan' },
	{ value: 'team', label: 'Team' },
];

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

function platformLabel(platform: BotPlatform, zh: boolean): string {
	const meta = PLATFORM_META[platform];
	return zh ? meta.labelZh : meta.labelEn;
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

function createBotForPlatform(platform: BotPlatform, zh: boolean): BotIntegrationConfig {
	return ensurePlatformShape(
		{
			...createEmptyBotIntegration(),
			platform,
			name: zh ? `${platformLabel(platform, true)} 机器人` : `${platformLabel(platform, false)} Bot`,
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

function modelLabel(modelId: string | undefined, modelEntries: UserModelEntry[], zh: boolean): string {
	if (!modelId) {
		return zh ? '未设置模型' : 'No model';
	}
	const entry = modelEntries.find((item) => item.id === modelId);
	return entry?.displayName.trim() || entry?.requestName || modelId;
}

function botCardSummary(item: BotIntegrationConfig, zh: boolean): { chats: string; users: string; prompt: string } {
	const chatCount = countAllowedChats(item);
	const userCount = countAllowedUsers(item);
	return {
		chats:
			zh
				? chatCount > 0
					? `${chatCount} 个群聊/频道白名单`
					: '群聊不限'
				: chatCount > 0
					? `${chatCount} group/channel targets`
					: 'No group filter',
		users:
			zh
				? userCount > 0
					? `${userCount} 个用户白名单`
					: '用户不限'
				: userCount > 0
					? `${userCount} whitelisted users`
					: 'No user filter',
		prompt: item.systemPrompt?.trim()
			? zh
				? '附加系统提示已配置'
				: 'Extra prompt configured'
			: zh
				? '使用默认桥接提示'
				: 'Using default bridge prompt',
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
	zh: boolean;
	mode: EditorMode;
	draft: BotIntegrationConfig;
	modelEntries: UserModelEntry[];
	onChangeDraft: (next: BotIntegrationConfig) => void;
	onClose: () => void;
	onSave: () => void;
};

function BotEditorModal(props: BotEditorModalProps) {
	const { zh, mode, draft, modelEntries, onChangeDraft, onClose, onSave } = props;
	const firstInputRef = useRef<HTMLInputElement | null>(null);
	const modelOptions = useMemo(
		() =>
			[{ value: '', label: zh ? '未设置' : 'Not set' }].concat(
				modelEntries.map((item) => ({
					value: item.id,
					label: item.displayName.trim() || item.requestName || item.id,
				}))
			),
		[modelEntries, zh]
	);
	const meta = PLATFORM_META[draft.platform];

	useEffect(() => {
		const timer = window.setTimeout(() => firstInputRef.current?.focus(), 40);
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				event.preventDefault();
				onClose();
			}
		};
		window.addEventListener('keydown', onKeyDown);
		return () => {
			window.clearTimeout(timer);
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
				aria-label={zh ? '编辑机器人' : 'Edit bot'}
				onClick={(event) => event.stopPropagation()}
				style={{ '--bot-accent': meta.accent } as CSSProperties}
			>
				<div className="ref-settings-bot-modal-head">
					<div className="ref-settings-bot-modal-head-main">
						<div className="ref-settings-bot-modal-mark">{platformIcon(draft.platform)}</div>
						<div>
							<div className="ref-settings-bot-modal-kicker">
								{mode === 'create' ? (zh ? '新建机器人' : 'Create bot') : zh ? '编辑机器人' : 'Edit bot'}
							</div>
							<h3 className="ref-settings-bot-modal-title">
								{draft.name.trim() || (zh ? `${platformLabel(draft.platform, true)} 机器人` : `${platformLabel(draft.platform, false)} Bot`)}
							</h3>
							<p className="ref-settings-bot-modal-subtitle">{zh ? meta.descriptionZh : meta.descriptionEn}</p>
						</div>
					</div>
					<button type="button" className="ref-settings-bot-modal-close" onClick={onClose}>
						{zh ? '关闭' : 'Close'}
					</button>
				</div>

				<div className="ref-settings-bot-modal-body">
					<section className="ref-settings-bot-section">
						<div className="ref-settings-bots-section-head">
							<div>
								<div className="ref-settings-bots-section-kicker">{zh ? 'Runtime' : 'Runtime'}</div>
								<h5 className="ref-settings-bots-section-title">{zh ? '基础信息' : 'Basics'}</h5>
							</div>
							<p className="ref-settings-bots-section-copy">
								{zh
									? '定义这个 bot 的平台、默认模型和默认模式。'
									: 'Define the platform, default model, and default mode for this bot.'}
							</p>
						</div>
						<div className="ref-settings-bot-grid ref-settings-bot-grid--runtime">
							<label className="ref-settings-field">
								<span>{zh ? '显示名称' : 'Display name'}</span>
								<input
									ref={firstInputRef}
									type="text"
									value={draft.name}
									onChange={(event) => patchDraft({ name: event.target.value })}
									placeholder={zh ? '例如：研发值班机器人' : 'Example: Incident Bot'}
								/>
							</label>
							<label className="ref-settings-field">
								<span>{zh ? '平台' : 'Platform'}</span>
								<VoidSelect
									value={draft.platform}
									onChange={(next) => onChangeDraft(ensurePlatformShape(draft, next as BotPlatform))}
									options={(Object.keys(PLATFORM_META) as BotPlatform[]).map((platform) => ({
										value: platform,
										label: platformLabel(platform, zh),
									}))}
									ariaLabel={zh ? '机器人平台' : 'Bot platform'}
								/>
							</label>
							<label className="ref-settings-field">
								<span>{zh ? '默认模型' : 'Default model'}</span>
								<VoidSelect
									value={draft.defaultModelId ?? ''}
									onChange={(next) => patchDraft({ defaultModelId: String(next ?? '') })}
									options={modelOptions}
									ariaLabel={zh ? '默认模型' : 'Default model'}
								/>
							</label>
							<label className="ref-settings-field">
								<span>{zh ? '默认模式' : 'Default mode'}</span>
								<VoidSelect
									value={draft.defaultMode ?? 'agent'}
									onChange={(next) => patchDraft({ defaultMode: next as BotComposerMode })}
									options={MODE_OPTIONS}
									ariaLabel={zh ? '默认模式' : 'Default mode'}
								/>
							</label>
						</div>
					</section>

					<section className="ref-settings-bot-section">
						<div className="ref-settings-bots-section-head">
							<div>
								<div className="ref-settings-bots-section-kicker">{zh ? 'Reply Scope' : 'Reply Scope'}</div>
								<h5 className="ref-settings-bots-section-title">{zh ? '回复白名单' : 'Reply whitelists'}</h5>
							</div>
							<p className="ref-settings-bots-section-copy">
								{zh
									? '限制这个 bot 允许在哪些群聊/频道里回复，以及允许响应哪些用户。留空表示不限制。'
									: 'Limit which group chats or channels this bot may reply in, and which users it may respond to. Leave blank to allow all.'}
							</p>
						</div>
						<div className="ref-settings-bot-grid">
							<label className="ref-settings-field">
								<span>{zh ? '允许回复的群聊/频道 ID（每行一个）' : 'Allowed group/channel ids (one per line)'}</span>
								<textarea
									value={textFromLines(draft.allowedReplyChatIds)}
									onChange={(event) => patchDraft({ allowedReplyChatIds: linesFromText(event.target.value) })}
									placeholder={
										zh
											? draft.platform === 'discord' || draft.platform === 'slack'
												? '例如：频道 Channel ID'
												: '例如：群聊 Chat ID'
											: draft.platform === 'discord' || draft.platform === 'slack'
												? 'Example: channel ids'
												: 'Example: group chat ids'
									}
								/>
								<p className="ref-settings-field-hint">
									{zh
										? draft.platform === 'discord' || draft.platform === 'slack'
											? '这里只限制频道场景；私聊不会被这项拦住。'
											: '这里只限制群聊/频道场景；私聊不会被这项拦住。'
										: draft.platform === 'discord' || draft.platform === 'slack'
											? 'This only gates channel contexts. Direct messages are not blocked by this field.'
											: 'This only gates group-chat contexts. Direct messages are not blocked by this field.'}
								</p>
							</label>
							<label className="ref-settings-field">
								<span>{zh ? '白名单用户 ID（每行一个）' : 'Whitelisted user ids (one per line)'}</span>
								<textarea
									value={textFromLines(draft.allowedReplyUserIds)}
									onChange={(event) => patchDraft({ allowedReplyUserIds: linesFromText(event.target.value) })}
									placeholder={zh ? '例如：平台上的用户 ID' : 'Example: user ids from this platform'}
								/>
								<p className="ref-settings-field-hint">
									{zh
										? '留空表示不限制用户；填写后只响应这些用户发来的消息。'
										: 'Leave blank to allow all users. When filled, only these user ids will receive replies.'}
								</p>
							</label>
						</div>
					</section>

					<section className="ref-settings-bot-section">
						<div className="ref-settings-bots-section-head">
							<div>
								<div className="ref-settings-bots-section-kicker">{platformLabel(draft.platform, zh)}</div>
								<h5 className="ref-settings-bots-section-title">{zh ? '平台接入信息' : 'Platform connection'}</h5>
							</div>
							<p className="ref-settings-bots-section-copy">{zh ? meta.tipZh : meta.tipEn}</p>
						</div>

						{draft.platform === 'telegram' ? (
							<div className="ref-settings-bot-platform-stack">
								<label className="ref-settings-field">
									<span>Bot Token</span>
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
										<strong>{zh ? '群聊回复策略' : 'Group reply policy'}</strong>
										<p>
											{zh
												? '决定机器人在 Telegram 群聊里，是只在被显式 @ 时回复，还是也允许直接响应群消息。'
												: 'Choose whether the bot should only reply when explicitly mentioned in Telegram groups, or also allow direct group replies.'}
										</p>
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
											<span>{zh ? '仅在被 @ 时回复' : 'Mention only'}</span>
											<small>{zh ? '推荐，减少误触发' : 'Recommended, fewer accidental triggers'}</small>
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
											<span>{zh ? '允许直接回复群消息' : 'Allow direct group replies'}</span>
											<small>{zh ? '更积极，但更容易打扰群聊' : 'More proactive, but noisier in groups'}</small>
										</button>
									</div>
								</div>
							</div>
						) : null}

						{draft.platform === 'slack' ? (
							<div className="ref-settings-bot-grid">
								<label className="ref-settings-field">
									<span>Bot Token</span>
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
									<span>App Token</span>
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
									<span>Bot Token</span>
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
									<span>{zh ? '服务器频道里必须显式提及机器人' : 'Require mentions in guild channels'}</span>
								</label>
							</div>
						) : null}

						{draft.platform === 'feishu' ? (
							<div className="ref-settings-bot-grid">
								<label className="ref-settings-field">
									<span>App ID</span>
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
									<span>App Secret</span>
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
									<span>{zh ? 'Encrypt Key（可选）' : 'Encrypt key (optional)'}</span>
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
									<span>{zh ? 'Verification Token（可选）' : 'Verification token (optional)'}</span>
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
					</section>

					<section className="ref-settings-bot-section">
						<div className="ref-settings-bots-section-head">
							<div>
								<div className="ref-settings-bots-section-kicker">{zh ? 'Persona' : 'Persona'}</div>
								<h5 className="ref-settings-bots-section-title">{zh ? '桥接层额外系统提示' : 'Extra bridge prompt'}</h5>
							</div>
							<p className="ref-settings-bots-section-copy">
								{zh
									? '这里只影响外部 bot 的桥接行为，比如默认语气、禁止事项或偏好的执行节奏。'
									: 'This only shapes the bridge behavior itself, such as tone, constraints, or preferred execution style.'}
							</p>
						</div>
						<label className="ref-settings-field">
							<span>{zh ? '额外系统提示（可选）' : 'Extra system prompt (optional)'}</span>
							<textarea
								value={draft.systemPrompt ?? ''}
								onChange={(event) => patchDraft({ systemPrompt: event.target.value })}
								placeholder={
									zh
										? '例如：先把需求拆成执行步骤，再调用 run_async_task；对生产环境更保守。'
										: 'Example: break requests into steps before run_async_task; be more conservative around production changes.'
								}
							/>
						</label>
					</section>
				</div>

				<div className="ref-settings-bot-modal-foot">
					<button type="button" className="ref-settings-bot-modal-btn is-ghost" onClick={onClose}>
						{zh ? '取消' : 'Cancel'}
					</button>
					<button type="button" className="ref-settings-bot-modal-btn is-primary" onClick={onSave}>
						{mode === 'create' ? (zh ? '创建机器人' : 'Create bot') : zh ? '保存修改' : 'Save changes'}
					</button>
				</div>
			</div>
		</div>
	);

	return typeof document !== 'undefined' ? createPortal(modal, document.body) : null;
}

export function SettingsBotsPanel({ value, onChange, modelEntries }: Props) {
	const { locale } = useI18n();
	const zh = locale !== 'en';
	const [editorMode, setEditorMode] = useState<EditorMode | null>(null);
	const [draft, setDraft] = useState<BotIntegrationConfig | null>(null);

	const activeCount = value.filter((item) => item.enabled !== false).length;
	const restrictedCount = value.filter((item) => countAllowedChats(item) > 0).length;
	const whitelistedUsers = value.reduce((sum, item) => sum + countAllowedUsers(item), 0);

	const openCreate = (platform: BotPlatform) => {
		setEditorMode('create');
		setDraft(createBotForPlatform(platform, zh));
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
							<div className="ref-settings-bots-kicker">{zh ? 'Bot Bridge' : 'Bot Bridge'}</div>
							<h3 className="ref-settings-bots-title">
								{zh ? '把 Async 能力接到外部机器人' : 'Bridge Async into external bots'}
							</h3>
							<p className="ref-settings-bots-subtitle">
								{zh
									? '每个机器人都有自己的默认模型、默认模式和回复白名单。新建和编辑都通过弹窗完成，列表页只保留摘要和快捷操作。'
									: 'Each bot has its own default model, mode, and reply whitelist. Creation and editing happen in a modal, while the list stays focused on summaries and quick actions.'}
							</p>
						</div>
						<div className="ref-settings-bots-stats">
							<div className="ref-settings-bots-stat">
								<span className="ref-settings-bots-stat-label">{zh ? '已配置' : 'Configured'}</span>
								<strong>{value.length}</strong>
							</div>
							<div className="ref-settings-bots-stat">
								<span className="ref-settings-bots-stat-label">{zh ? '已启用' : 'Enabled'}</span>
								<strong>{activeCount}</strong>
							</div>
							<div className="ref-settings-bots-stat">
								<span className="ref-settings-bots-stat-label">{zh ? '群聊白名单' : 'Group Targets'}</span>
								<strong>{restrictedCount}</strong>
							</div>
							<div className="ref-settings-bots-stat">
								<span className="ref-settings-bots-stat-label">{zh ? '用户白名单' : 'User Whitelist'}</span>
								<strong>{whitelistedUsers}</strong>
							</div>
						</div>
					</section>

					<section className="ref-settings-bots-add-section">
						<div className="ref-settings-bots-section-head">
							<div>
								<div className="ref-settings-bots-section-kicker">{zh ? 'Quick Start' : 'Quick Start'}</div>
								<h4 className="ref-settings-bots-section-title">{zh ? '按平台快速新建' : 'Create by platform'}</h4>
							</div>
							<p className="ref-settings-bots-section-copy">
								{zh
									? '先选一个平台打开配置弹窗，再补平台凭据、默认模型和回复白名单。'
									: 'Pick a platform to open the editor modal, then fill in credentials, the default model, and reply whitelists.'}
							</p>
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
											<strong>{platformLabel(platform, zh)}</strong>
											<span>{zh ? meta.addHintZh : meta.addHintEn}</span>
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
								<h4>{zh ? '还没有机器人接入' : 'No bot integrations yet'}</h4>
								<p>
									{zh
										? '从上面的平台卡片开始。你可以给不同团队、不同频道或不同白名单策略分别配置专属机器人。'
										: 'Start from one of the platform cards above. You can create separate bots for different teams, channels, or whitelist policies.'}
								</p>
							</div>
						</section>
					) : null}

					<div className="ref-settings-bots-list">
						{value.map((item, index) => {
							const current = ensurePlatformShape(item, item.platform);
							const meta = PLATFORM_META[current.platform];
							const summary = botCardSummary(current, zh);
							const modelText = modelLabel(current.defaultModelId, modelEntries, zh);
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
													{zh ? `机器人 #${index + 1}` : `Bot #${index + 1}`} · {platformLabel(current.platform, zh)}
												</div>
												<h4 className="ref-settings-bot-card-title">
													{current.name.trim() || (zh ? `${platformLabel(current.platform, true)} 机器人` : `${platformLabel(current.platform, false)} Bot`)}
												</h4>
												<p className="ref-settings-bot-card-subtitle">
													{zh ? meta.descriptionZh : meta.descriptionEn}
												</p>
											</div>
										</div>
										<div className="ref-settings-bot-card-actions">
											<button
												type="button"
												className={`ref-settings-bot-chip-btn ${current.enabled !== false ? 'is-active' : ''}`}
												onClick={() => toggleEnabled(current.id)}
											>
												{current.enabled !== false ? (zh ? '已启用' : 'Enabled') : zh ? '已暂停' : 'Paused'}
											</button>
											<button
												type="button"
												className="ref-settings-bot-chip-btn"
												onClick={() => openEdit(current)}
											>
												{zh ? '编辑' : 'Edit'}
											</button>
											<button
												type="button"
												className="ref-settings-bot-chip-btn is-danger"
												onClick={() => removeOne(current.id)}
											>
												{zh ? '删除' : 'Remove'}
											</button>
										</div>
									</div>

									<div className="ref-settings-bot-badges">
										<span className="ref-settings-bot-badge">{current.defaultMode ?? 'agent'}</span>
										<span className="ref-settings-bot-badge">{modelText}</span>
										<span className="ref-settings-bot-badge">{summary.chats}</span>
										<span className="ref-settings-bot-badge">{summary.users}</span>
									</div>

									<div className="ref-settings-bot-overview">
										<div className="ref-settings-bot-overview-item">
											<span>{zh ? '群聊范围' : 'Group Scope'}</span>
											<strong>{summary.chats}</strong>
										</div>
										<div className="ref-settings-bot-overview-item">
											<span>{zh ? '用户白名单' : 'User whitelist'}</span>
											<strong>{summary.users}</strong>
										</div>
										<div className="ref-settings-bot-overview-item">
											<span>{zh ? '桥接提示' : 'Bridge prompt'}</span>
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
					zh={zh}
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
