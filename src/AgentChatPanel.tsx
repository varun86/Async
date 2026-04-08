import {
	Fragment,
	memo,
	useCallback,
	useState,
	type ComponentProps,
	type Dispatch,
	type ReactNode,
	type RefObject,
	type SetStateAction,
} from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ChatMarkdown } from './ChatMarkdown';
import { AgentReviewPanel } from './AgentReviewPanel';
import { AgentFileChangesPanel } from './AgentFileChanges';
import { ChatComposer } from './ChatComposer';
import { PlanQuestionDialog } from './PlanQuestionDialog';
import { SkillScopeDialog } from './SkillScopeDialog';
import { RuleWizardDialog } from './RuleWizardDialog';
import { SubagentScopeDialog } from './SubagentScopeDialog';
import { ToolApprovalInlineCard, type ToolApprovalPayload } from './ToolApprovalCard';
import { AgentMistakeLimitDialog, type MistakeLimitPayload } from './AgentMistakeLimitDialog';
import { PlanReviewPanel } from './PlanReviewPanel';
import { ComposerThoughtBlock } from './ComposerThoughtBlock';
import { UserMessageRich } from './UserMessageRich';
import { assistantMessageUsesAgentToolProtocol, extractLastTodosFromContent, type FileChangeSummary } from './agentChatSegments';
import { userMessageToSegments, type ComposerSegment } from './composerSegments';
import type { WizardPending } from './hooks/useWizardPending';
import type { TFunction } from './i18n';
import { isChatAssistantErrorLine } from './i18n';
import { type AgentPendingPatch, type TurnTokenUsage } from './ipcTypes';
import { extractTodosFromLiveBlocks, type LiveAgentBlocksState } from './liveAgentBlocks';
import { IconArrowDown, IconChevron, IconDoc } from './icons';
import { type ParsedPlan, type PlanQuestion } from './planParser';
import { type ChatMessage } from './threadTypes';

type SharedComposerProps = Omit<
	ComponentProps<typeof ChatComposer>,
	'slot' | 'variant' | 'segments' | 'setSegments' | 'canSend' | 'extraClass' | 'showGitBranchRow'
>;

export type AgentChatPanelProps = {
	layout?: 'agent-center' | 'editor-rail';
	t: TFunction;
	hasConversation: boolean;
	displayMessages: ChatMessage[];
	persistedMessageCount: number;
	messagesThreadId: string | null;
	currentId: string | null;
	lastAssistantMessageIndex: number;
	lastUserMessageIndex: number;
	messagesViewportRef: RefObject<HTMLDivElement | null>;
	messagesTrackRef: RefObject<HTMLDivElement | null>;
	inlineResendRootRef: RefObject<HTMLDivElement | null>;
	onMessagesScroll: () => void;
	awaitingReply: boolean;
	thinkingTickRef: React.RefObject<number>;
	streamStartedAtRef: RefObject<number | null>;
	firstTokenAtRef: RefObject<number | null>;
	thoughtSecondsByThread: Record<string, number>;
	lastTurnUsage: TurnTokenUsage | null;
	composerMode: ComponentProps<typeof ChatComposer>['composerMode'];
	streaming: string;
	streamingThinking: string;
	streamingToolPreview: ComponentProps<typeof ChatMarkdown>['streamingToolPreview'];
	liveAssistantBlocks: LiveAgentBlocksState;
	workspace: string | null;
	workspaceBasename: string;
	workspaceFileList: string[];
	revertedFiles: ReadonlySet<string>;
	revertedChangeKeys: ReadonlySet<string>;
	resendFromUserIndex: number | null;
	inlineResendSegments: ComposerSegment[];
	setInlineResendSegments: Dispatch<SetStateAction<ComposerSegment[]>>;
	composerSegments: ComposerSegment[];
	setComposerSegments: Dispatch<SetStateAction<ComposerSegment[]>>;
	canSendComposer: boolean;
	canSendInlineResend: boolean;
	sharedComposerProps: SharedComposerProps;
	onStartInlineResend: (userMessageIndex: number, content: string) => void;
	onOpenWorkspaceFile: (rel: string) => void;
	onOpenAgentConversationFile: (
		rel: string,
		line?: number,
		end?: number,
		options?: { diff?: string | null; allowReviewActions?: boolean }
	) => void;
	onRunCommand: (cmd: string) => void;
	pendingAgentPatches: AgentPendingPatch[];
	agentReviewBusy: boolean;
	onApplyAgentPatchOne: (id: string) => void;
	onApplyAgentPatchesAll: () => void;
	onDiscardAgentReview: () => void;
	planQuestion: PlanQuestion | null;
	onPlanQuestionSubmit: (answer: string) => void;
	onPlanQuestionSkip: () => void;
	wizardPending: WizardPending | null;
	setWizardPending: Dispatch<SetStateAction<WizardPending | null>>;
	executeSkillCreatorSend: (scope: 'user' | 'project', pending: WizardPending) => void;
	executeRuleWizardSend: (
		ruleScope: 'always' | 'glob' | 'manual',
		globPattern: string | undefined,
		pending: WizardPending
	) => void;
	executeSubagentWizardSend: (scope: 'user' | 'project', pending: WizardPending) => void;
	mistakeLimitRequest: MistakeLimitPayload | null;
	respondMistakeLimit: (action: 'continue' | 'stop' | 'hint', hint?: string) => void;
	agentPlanEffectivePlan: ParsedPlan | null;
	editorPlanReviewDismissed: boolean;
	planFileRelPath: string | null;
	planFilePath: string | null;
	defaultModel: string;
	modelPickerItems: ComponentProps<typeof PlanReviewPanel>['modelItems'];
	planReviewIsBuilt: boolean;
	onPlanBuild: (modelId: string) => void;
	onPlanReviewClose: () => void;
	onPlanTodoToggle: (id: string) => void;
	toolApprovalRequest: ToolApprovalPayload | null;
	respondToolApproval: (allow: boolean) => void;
	agentFileChanges: FileChangeSummary[];
	fileChangesDismissed: boolean;
	onKeepAllEdits: () => void;
	onRevertAllEdits: () => void;
	onKeepFileEdit: (rel: string) => void;
	onRevertFileEdit: (rel: string) => void;
	showScrollToBottomButton: boolean;
	scrollMessagesToBottom: (behavior?: ScrollBehavior) => void;
	agentPlanSummaryCard: ReactNode;
};

/** 达到条数后启用虚拟列表（与 .ref-messages-track 的 gap 对齐，减轻长对话 DOM 压力） */
const MESSAGE_LIST_VIRTUAL_THRESHOLD = 48;

/** 仅长列表挂载：短对话不调用 useVirtualizer，避免与 composer 测高等同步布局挤在同一任务 */
const AgentMessagesVirtualizedTrack = memo(function AgentMessagesVirtualizedTrack({
	viewportRef,
	trackRef,
	conversationRenderKey,
	messageTrackGap,
	count,
	renderRow,
}: {
	viewportRef: RefObject<HTMLDivElement | null>;
	trackRef: RefObject<HTMLDivElement | null>;
	conversationRenderKey: string;
	messageTrackGap: number;
	count: number;
	renderRow: (index: number) => ReactNode;
}) {
	const virtualizer = useVirtualizer({
		count,
		getScrollElement: () => viewportRef.current,
		estimateSize: () => 140,
		overscan: 12,
		gap: messageTrackGap,
		getItemKey: (index) => `${conversationRenderKey}-${index}`,
	});
	return (
		<div
			key={`messages-track-${conversationRenderKey}`}
			ref={trackRef}
			className="ref-messages-track ref-messages-track--virtual"
			style={{
				height: `${virtualizer.getTotalSize()}px`,
				position: 'relative',
				width: '100%',
			}}
		>
			{virtualizer.getVirtualItems().map((vi) => (
				<div
					key={vi.key}
					data-index={vi.index}
					ref={virtualizer.measureElement}
					className="ref-msg-virtual-row"
					style={{
						position: 'absolute',
						top: 0,
						left: 0,
						width: '100%',
						transform: `translateY(${vi.start}px)`,
					}}
				>
					{renderRow(vi.index)}
				</div>
			))}
		</div>
	);
});

export const AgentChatPanel = memo(function AgentChatPanel({
	layout = 'agent-center',
	t,
	hasConversation,
	displayMessages,
	persistedMessageCount,
	messagesThreadId,
	currentId,
	lastAssistantMessageIndex,
	lastUserMessageIndex,
	messagesViewportRef,
	messagesTrackRef,
	inlineResendRootRef,
	onMessagesScroll,
	awaitingReply,
	thinkingTickRef,
	streamStartedAtRef,
	firstTokenAtRef,
	thoughtSecondsByThread,
	lastTurnUsage,
	composerMode,
	streaming,
	streamingThinking,
	streamingToolPreview,
	liveAssistantBlocks,
	workspace,
	workspaceBasename,
	workspaceFileList,
	revertedFiles,
	revertedChangeKeys,
	resendFromUserIndex,
	inlineResendSegments,
	setInlineResendSegments,
	composerSegments,
	setComposerSegments,
	canSendComposer,
	canSendInlineResend,
	sharedComposerProps,
	onStartInlineResend,
	onOpenWorkspaceFile,
	onOpenAgentConversationFile,
	onRunCommand,
	pendingAgentPatches,
	agentReviewBusy,
	onApplyAgentPatchOne,
	onApplyAgentPatchesAll,
	onDiscardAgentReview,
	planQuestion,
	onPlanQuestionSubmit,
	onPlanQuestionSkip,
	wizardPending,
	setWizardPending,
	executeSkillCreatorSend,
	executeRuleWizardSend,
	executeSubagentWizardSend,
	mistakeLimitRequest,
	respondMistakeLimit,
	agentPlanEffectivePlan,
	editorPlanReviewDismissed,
	planFileRelPath,
	planFilePath,
	defaultModel,
	modelPickerItems,
	planReviewIsBuilt,
	onPlanBuild,
	onPlanReviewClose,
	onPlanTodoToggle,
	toolApprovalRequest,
	respondToolApproval,
	agentFileChanges,
	fileChangesDismissed,
	onKeepAllEdits,
	onRevertAllEdits,
	onKeepFileEdit,
	onRevertFileEdit,
	showScrollToBottomButton,
	scrollMessagesToBottom,
	agentPlanSummaryCard,
}: AgentChatPanelProps) {
	if (import.meta.env.DEV) {
		console.log(`[perf] AgentChatPanel render: thread=${messagesThreadId}, messages=${displayMessages.length}, hasConv=${hasConversation}`);
	}
	const isEditorRail = layout === 'editor-rail';
	const [collapsedTodos, setCollapsedTodos] = useState<Set<number>>(new Set());
	const toggleTodoCollapse = useCallback((msgIndex: number) => {
		setCollapsedTodos(prev => {
			const next = new Set(prev);
			if (next.has(msgIndex)) next.delete(msgIndex);
			else next.add(msgIndex);
			return next;
		});
	}, []);
	const conversationRenderKey = messagesThreadId ?? 'no-thread';
	const messageTrackGap = isEditorRail ? 20 : 22;
	const virtualListEnabled =
		hasConversation && displayMessages.length >= MESSAGE_LIST_VIRTUAL_THRESHOLD;

	const messageNodeAtIndex = (i: number): ReactNode => {
			const m = displayMessages[i];
			if (!m) {
				return null;
			}
			const convoKey = conversationRenderKey;
			const isLast = i === displayMessages.length - 1;
			const stAt = streamStartedAtRef.current;
			const ftAt = firstTokenAtRef.current;
			const showLiveThought = isLast && m.role === 'assistant' && awaitingReply;
			const agentOrPlanStreaming =
				(composerMode === 'agent' || composerMode === 'plan') && awaitingReply && isLast;
			const frozenSec =
				!awaitingReply && isLast && m.role === 'assistant' && currentId
					? thoughtSecondsByThread[currentId]
					: undefined;

			let thoughtBlock: ReactNode = null;
			let liveThoughtMeta: ComponentProps<typeof ChatMarkdown>['liveThoughtMeta'] = null;
			let thoughtAfterBody = false;
			if (showLiveThought && stAt) {
				void thinkingTickRef.current; // 读取 ref 以建立依赖
				const assistantTurnHasOutput =
					streaming.trim().length > 0 ||
					streamingToolPreview != null ||
					(agentOrPlanStreaming && liveAssistantBlocks.blocks.length > 0);
				const phase = assistantTurnHasOutput ? 'streaming' : 'thinking';
				thoughtAfterBody =
					assistantTurnHasOutput && composerMode !== 'ask' && composerMode !== 'debug';
				const elapsed =
					phase === 'thinking'
						? Math.max(0, (Date.now() - stAt) / 1000)
						: ftAt
							? Math.max(0, (ftAt - stAt) / 1000)
							: Math.max(0, (Date.now() - stAt) / 1000);
				if (agentOrPlanStreaming) {
					liveThoughtMeta = {
						phase,
						elapsedSeconds: elapsed,
						streamingThinking,
					};
				} else {
					thoughtBlock = (
						<ComposerThoughtBlock
							phase={phase}
							elapsedSeconds={elapsed}
							streamingThinking={streamingThinking}
						/>
					);
				}
			} else if (frozenSec != null) {
				thoughtAfterBody = true;
				thoughtBlock = (
					<ComposerThoughtBlock
						phase="done"
						elapsedSeconds={frozenSec}
						tokenUsage={isLast ? lastTurnUsage : undefined}
					/>
				);
			}

			const pendingEmptyAssistant =
				m.role === 'assistant' &&
				m.content.trim() === '' &&
				awaitingReply &&
				isLast &&
				streamingToolPreview == null &&
				!(agentOrPlanStreaming && (liveAssistantBlocks.blocks.length > 0 || liveThoughtMeta != null));
			const userMessageIndex = i < persistedMessageCount && m.role === 'user' ? i : -1;
			const isEditingThisUser = userMessageIndex >= 0 && resendFromUserIndex === userMessageIndex;

			if (m.role === 'user' && isEditingThisUser) {
				const inner = (
					<div ref={inlineResendRootRef} className="ref-msg-slot ref-msg-slot--composer">
						<ChatComposer
							{...sharedComposerProps}
							slot="inline"
							segments={inlineResendSegments}
							setSegments={setInlineResendSegments}
							canSend={canSendInlineResend}
							extraClass="ref-capsule--inline-edit"
							showGitBranchRow={false}
						/>
					</div>
				);
				return i === lastUserMessageIndex ? (
					<div key={`u-edit-${convoKey}-${i}`} className="ref-msg-sticky-user-wrap">
						{inner}
					</div>
				) : (
					<Fragment key={`u-edit-${convoKey}-${i}`}>{inner}</Fragment>
				);
			}

			if (m.role === 'user') {
				const userSegs = userMessageToSegments(m.content, workspaceFileList);

				// Look ahead: does the next assistant message contain TodoWrite?
				const nextMsg = displayMessages[i + 1];
				const isNextAssistantStreaming = nextMsg?.role === 'assistant' && (i + 1) === displayMessages.length - 1 && awaitingReply;
				const userTodos = nextMsg?.role === 'assistant'
					? (isNextAssistantStreaming && liveAssistantBlocks
						? extractTodosFromLiveBlocks(liveAssistantBlocks.blocks)
						: (typeof nextMsg.content === 'string' ? extractLastTodosFromContent(nextMsg.content) : null))
					: null;
				const hasTodoPanel = userTodos != null && userTodos.length > 0;

				const inner = (
					<div className={`ref-msg-slot ref-msg-slot--user${hasTodoPanel ? ' has-todo-panel' : ''}`}>
						<button
							type="button"
							className="ref-msg-user"
							disabled={awaitingReply}
							title={awaitingReply ? t('app.userMsgGenerating') : t('app.userMsgEditHint')}
							onClick={() => {
								if (awaitingReply) {
									return;
								}
								onStartInlineResend(userMessageIndex, m.content);
							}}
						>
							<UserMessageRich segments={userSegs} onFileClick={onOpenWorkspaceFile} />
						</button>
						{hasTodoPanel && (() => {
							const doneCount = userTodos!.filter(td => td.status === 'completed').length;
							const allDone = doneCount === userTodos!.length;
							const userToggled = collapsedTodos.has(i);
							const isCollapsed = userToggled ? !allDone : allDone;
							return (
								<div className="ref-plan-review-todos ref-agent-todo-panel">
									<button
										type="button"
										className="ref-plan-review-todos-head"
										onClick={(e) => { e.stopPropagation(); toggleTodoCollapse(i); }}
									>
										<span>{t('plan.review.todo', { done: doneCount, total: userTodos!.length })}</span>
										<svg className={`ref-plan-review-chev${isCollapsed ? '' : ' is-open'}`} width="16" height="16" viewBox="0 0 16 16" fill="none">
											<path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
										</svg>
									</button>
									{!isCollapsed && (
										<div className="ref-plan-review-todos-list">
											{userTodos!.map((todo) => {
												const done = todo.status === 'completed';
												const active = todo.status === 'in_progress';
												return (
													<div key={todo.id} className={`ref-plan-todo ${done ? 'is-done' : ''} ${active ? 'is-active' : ''}`}>
														{active ? (
															<span className="ref-plan-todo-spinner" aria-hidden />
														) : (
															<svg className="ref-plan-todo-check" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
																<rect
																	x="1" y="1" width="14" height="14" rx="3"
																	stroke="currentColor"
																	strokeWidth="1.5"
																	fill={done ? 'currentColor' : 'none'}
																/>
																{done ? (
																	<path d="M4.5 8l2.5 2.5 4.5-5" stroke="var(--void-bg-3, #1a1a1a)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
																) : null}
															</svg>
														)}
														<span className="ref-plan-todo-text">
															{active && todo.activeForm ? todo.activeForm : todo.content}
														</span>
													</div>
												);
											})}
										</div>
									)}
								</div>
							);
						})()}
					</div>
				);
				return i === lastUserMessageIndex ? (
					<div key={`u-${convoKey}-${i}`} className="ref-msg-sticky-user-wrap">
						{inner}
					</div>
				) : (
					<Fragment key={`u-${convoKey}-${i}`}>{inner}</Fragment>
				);
			}

			return (
				<div key={`a-${convoKey}-${i}`} className="ref-msg-slot ref-msg-slot--assistant">
					{thoughtBlock && !thoughtAfterBody ? thoughtBlock : null}
					{/* TODO panel moved to user message bubble */}
					<div className="ref-msg-assistant-body">
						{pendingEmptyAssistant ? (
							<span className="ref-bubble-pending" aria-hidden>
								<span className="ref-bubble-pending-dot" />
								<span className="ref-bubble-pending-dot" />
								<span className="ref-bubble-pending-dot" />
							</span>
						) : (
							<ChatMarkdown
								content={m.content}
								agentUi={
									composerMode === 'plan' ||
									composerMode === 'agent' ||
									assistantMessageUsesAgentToolProtocol(m.content)
								}
								assistantBubbleVariant={
									m.role === 'assistant' && isChatAssistantErrorLine(m.content, t)
										? 'error'
										: 'default'
								}
								planUi={composerMode === 'plan'}
								workspaceRoot={workspace}
								onOpenAgentFile={onOpenAgentConversationFile}
								onRunCommand={onRunCommand}
								streamingToolPreview={agentOrPlanStreaming ? streamingToolPreview : null}
								showAgentWorking={agentOrPlanStreaming}
								liveAgentBlocksState={agentOrPlanStreaming ? liveAssistantBlocks : null}
								liveThoughtMeta={agentOrPlanStreaming ? liveThoughtMeta : null}
								revertedPaths={revertedFiles}
								revertedChangeKeys={revertedChangeKeys}
								allowAgentFileActions={
									composerMode === 'agent' && !awaitingReply && i === lastAssistantMessageIndex
								}
								skipPlanTodo
							/>
						)}
					</div>
					{thoughtBlock && thoughtAfterBody ? thoughtBlock : null}
				</div>
			);
	};

	const buildFlatMessageList = (): ReactNode[] => {
		const t0 = import.meta.env.DEV ? performance.now() : 0;
		const nodes = displayMessages.map((_, i) => messageNodeAtIndex(i)) as ReactNode[];
		if (import.meta.env.DEV) {
			const elapsed = performance.now() - t0;
			if (elapsed > 12) {
				console.log(
					`[perf] renderChatMessageList: ${elapsed.toFixed(1)}ms, messages=${displayMessages.length}, workspaceFiles=${workspaceFileList.length}, awaiting=${awaitingReply}`
				);
			}
		}
		return nodes;
	};

	const messagesEl = hasConversation ? (
		<div
			className={`ref-messages${virtualListEnabled ? ' ref-messages--virtual' : ''}`}
			ref={messagesViewportRef}
			onScroll={onMessagesScroll}
		>
			{virtualListEnabled ? (
				<AgentMessagesVirtualizedTrack
					viewportRef={messagesViewportRef}
					trackRef={messagesTrackRef}
					conversationRenderKey={conversationRenderKey}
					messageTrackGap={messageTrackGap}
					count={displayMessages.length}
					renderRow={messageNodeAtIndex}
				/>
			) : (
				<div
					key={`messages-track-${conversationRenderKey}`}
					className="ref-messages-track"
					ref={messagesTrackRef}
				>
					{buildFlatMessageList()}
				</div>
			)}
		</div>
	) : null;

	const editorRailHeroComposer =
		isEditorRail && !hasConversation ? (
			<ChatComposer
				{...sharedComposerProps}
				slot="hero"
				variant="editor-hero"
				segments={composerSegments}
				setSegments={setComposerSegments}
				canSend={canSendComposer}
				showGitBranchRow={false}
			/>
		) : null;

	const editorContextStrip = isEditorRail ? (
		<div className="ref-editor-rail-context-strip">
			<IconDoc className="ref-context-icon" />
			<span className="ref-editor-rail-context-local">{t('app.editorChatContextLocal')}</span>
			<IconChevron className="ref-editor-rail-context-chev" aria-hidden />
			<span className="ref-editor-rail-context-path" title={workspace ?? undefined}>
				{workspace ? workspaceBasename : t('app.noWorkspace')}
			</span>
		</div>
	) : null;

	const sharedOverlays = (
		<>
			{hasConversation && pendingAgentPatches.length > 0 ? (
				<AgentReviewPanel
					patches={pendingAgentPatches}
					workspaceRoot={workspace}
					busy={agentReviewBusy}
					onOpenFile={(rel, line, end, options) =>
						onOpenAgentConversationFile(rel, line, end, {
							...options,
							allowReviewActions: true,
						})
					}
					onApplyOne={onApplyAgentPatchOne}
					onApplyAll={onApplyAgentPatchesAll}
					onDiscard={onDiscardAgentReview}
				/>
			) : null}

			{hasConversation && planQuestion && composerMode === 'plan' ? (
				<PlanQuestionDialog
					question={planQuestion}
					onSubmit={onPlanQuestionSubmit}
					onSkip={onPlanQuestionSkip}
				/>
			) : null}

			{wizardPending?.kind === 'create-skill' ? (
				<SkillScopeDialog
					workspaceOpen={!!workspace}
					onCancel={() => setWizardPending(null)}
					onConfirm={(scope) => {
						const p = wizardPending;
						setWizardPending(null);
						if (p?.kind === 'create-skill') {
							void executeSkillCreatorSend(scope, p);
						}
					}}
				/>
			) : null}
			{wizardPending?.kind === 'create-rule' ? (
				<RuleWizardDialog
					onCancel={() => setWizardPending(null)}
					onConfirm={(ruleScope, globPattern) => {
						const p = wizardPending;
						setWizardPending(null);
						if (p?.kind === 'create-rule') {
							void executeRuleWizardSend(ruleScope, globPattern, p);
						}
					}}
				/>
			) : null}
			{wizardPending?.kind === 'create-subagent' ? (
				<SubagentScopeDialog
					workspaceOpen={!!workspace}
					onCancel={() => setWizardPending(null)}
					onConfirm={(scope) => {
						const p = wizardPending;
						setWizardPending(null);
						if (p?.kind === 'create-subagent') {
							void executeSubagentWizardSend(scope, p);
						}
					}}
				/>
			) : null}

			<AgentMistakeLimitDialog
				open={mistakeLimitRequest !== null}
				payload={mistakeLimitRequest}
				onContinue={() => void respondMistakeLimit('continue')}
				onStop={() => void respondMistakeLimit('stop')}
				onSendHint={(hint) => void respondMistakeLimit('hint', hint)}
				title={t('agent.mistakeLimit.title')}
				body={
					mistakeLimitRequest
						? t('agent.mistakeLimit.body', {
								count: mistakeLimitRequest.consecutiveFailures,
								threshold: mistakeLimitRequest.threshold,
							})
						: ''
				}
				continueLabel={t('agent.mistakeLimit.continue')}
				stopLabel={t('agent.mistakeLimit.stop')}
				hintFieldLabel={t('agent.mistakeLimit.hintField')}
				sendHintLabel={t('agent.mistakeLimit.sendHint')}
				hintPlaceholder={t('agent.mistakeLimit.hintPlaceholder')}
			/>

			{isEditorRail &&
			hasConversation &&
			agentPlanEffectivePlan &&
			composerMode === 'plan' &&
			!editorPlanReviewDismissed ? (
				<PlanReviewPanel
					plan={agentPlanEffectivePlan}
					planFileDisplayPath={planFileRelPath ?? planFilePath}
					initialBuildModelId={defaultModel}
					modelItems={modelPickerItems}
					planBuilt={planReviewIsBuilt}
					buildDisabled={awaitingReply}
					onBuild={onPlanBuild}
					onClose={onPlanReviewClose}
					onTodoToggle={onPlanTodoToggle}
				/>
			) : null}
		</>
	);

	const commandStack = (
		<div className="ref-command-stack">
			{toolApprovalRequest ? (
				<ToolApprovalInlineCard
					payload={toolApprovalRequest}
					onAllow={() => void respondToolApproval(true)}
					onDeny={() => void respondToolApproval(false)}
					title={
						toolApprovalRequest.toolName === 'execute_command'
							? t('agent.toolApproval.titleShell')
							: t('agent.toolApproval.titleWrite')
					}
					allowLabel={t('agent.toolApproval.allow')}
					denyLabel={t('agent.toolApproval.deny')}
				/>
			) : null}
			{hasConversation &&
			composerMode === 'agent' &&
			agentFileChanges.length > 0 &&
			!awaitingReply &&
			!fileChangesDismissed ? (
				<AgentFileChangesPanel
					files={agentFileChanges}
					onOpenFile={(rel, line, end, options) =>
						onOpenAgentConversationFile(rel, line, end, {
							...options,
							allowReviewActions: true,
						})
					}
					onKeepAll={onKeepAllEdits}
					onRevertAll={() => void onRevertAllEdits()}
					onKeepFile={(rel) => void onKeepFileEdit(rel)}
					onRevertFile={(rel) => void onRevertFileEdit(rel)}
				/>
			) : null}
			{hasConversation ? (
				<div
					className={`ref-scroll-jump-anchor ${showScrollToBottomButton ? 'is-visible' : ''}`}
					aria-hidden={!showScrollToBottomButton}
				>
					<button
						type="button"
						className="ref-scroll-jump-btn"
						tabIndex={showScrollToBottomButton ? 0 : -1}
						title={t('app.jumpToLatest')}
						aria-label={t('app.jumpToLatest')}
						onClick={() => scrollMessagesToBottom('smooth')}
					>
						<IconArrowDown className="ref-scroll-jump-btn-icon" />
					</button>
				</div>
			) : null}
			{!isEditorRail ? agentPlanSummaryCard : null}
			{hasConversation || !isEditorRail ? (
				<ChatComposer
					{...sharedComposerProps}
					slot="bottom"
					segments={composerSegments}
					setSegments={setComposerSegments}
					canSend={canSendComposer}
					showGitBranchRow={!isEditorRail}
				/>
			) : null}
		</div>
	);

	if (isEditorRail) {
		return (
			<>
				<div className="ref-editor-chat-body">
					{!hasConversation ? (
						<>
							{editorRailHeroComposer}
							{editorContextStrip}
							<div className="ref-editor-rail-message-spring" aria-hidden />
						</>
					) : (
						<>
							{editorContextStrip}
							{messagesEl}
						</>
					)}
				</div>
				{sharedOverlays}
				{commandStack}
			</>
		);
	}

	return (
		<>
			{messagesEl}
			{!hasConversation ? <div className="ref-hero-spacer" /> : null}
			{sharedOverlays}
			{commandStack}
		</>
	);
});
