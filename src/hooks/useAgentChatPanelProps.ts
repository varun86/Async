import { useCallback, useMemo } from 'react';
import type { AgentChatPanelProps } from '../AgentChatPanel';

export type UseAgentChatPanelPropsParams = Omit<
	AgentChatPanelProps,
	'layout' | 'onOpenWorkspaceFile' | 'onRunCommand' | 'onOpenAgentConversationFile'
> & {
	shell: Window['asyncShell'] | undefined;
	onExplorerOpenFile: (rel: string) => void | Promise<void>;
	onAgentConversationOpenFile: AgentChatPanelProps['onOpenAgentConversationFile'];
};

export function useAgentChatPanelProps({
	shell,
	onExplorerOpenFile,
	onAgentConversationOpenFile,
	...rest
}: UseAgentChatPanelPropsParams): Omit<AgentChatPanelProps, 'layout'> {
	const onOpenWorkspaceFile = useCallback(
		(rel: string) => {
			void onExplorerOpenFile(rel);
		},
		[onExplorerOpenFile]
	);

	const onRunCommand = useCallback(
		(cmd: string) => {
			shell?.invoke('terminal:execLine', cmd).catch(console.error);
		},
		[shell]
	);

	const result = useMemo(
		() => ({
			...rest,
			onOpenWorkspaceFile,
			onOpenAgentConversationFile: onAgentConversationOpenFile,
			onRunCommand,
		}),
		[
			onOpenWorkspaceFile,
			onRunCommand,
			onAgentConversationOpenFile,
			rest.t,
			rest.hasConversation,
			rest.displayMessages,
			rest.persistedMessageCount,
			rest.messagesThreadId,
			rest.currentId,
			rest.lastAssistantMessageIndex,
			rest.lastUserMessageIndex,
			rest.messagesViewportRef,
			rest.messagesTrackRef,
			rest.inlineResendRootRef,
			rest.onMessagesScroll,
			rest.awaitingReply,
			rest.thinkingTickRef,
			rest.streamStartedAtRef,
			rest.firstTokenAtRef,
			rest.thoughtSecondsByThread,
			rest.lastTurnUsage,
			rest.composerMode,
			rest.streaming,
			rest.streamingThinking,
			rest.streamingToolPreview,
			rest.liveAssistantBlocks,
			rest.workspace,
			rest.workspaceBasename,
			rest.workspaceFileList,
			rest.revertedFiles,
			rest.revertedChangeKeys,
			rest.resendFromUserIndex,
			rest.inlineResendSegments,
			rest.setInlineResendSegments,
			rest.composerSegments,
			rest.setComposerSegments,
			rest.canSendComposer,
			rest.canSendInlineResend,
			rest.sharedComposerProps,
			rest.onStartInlineResend,
			rest.pendingAgentPatches,
			rest.agentReviewBusy,
			rest.onApplyAgentPatchOne,
			rest.onApplyAgentPatchesAll,
			rest.onDiscardAgentReview,
			rest.planQuestion,
			rest.onPlanQuestionSubmit,
			rest.onPlanQuestionSkip,
			rest.wizardPending,
			rest.setWizardPending,
			rest.executeSkillCreatorSend,
			rest.executeRuleWizardSend,
			rest.executeSubagentWizardSend,
			rest.mistakeLimitRequest,
			rest.respondMistakeLimit,
			rest.agentPlanEffectivePlan,
			rest.editorPlanReviewDismissed,
			rest.planFileRelPath,
			rest.planFilePath,
			rest.defaultModel,
			rest.modelPickerItems,
			rest.planReviewIsBuilt,
			rest.onPlanBuild,
			rest.onPlanReviewClose,
			rest.onPlanTodoToggle,
			rest.toolApprovalRequest,
			rest.respondToolApproval,
			rest.agentFileChanges,
			rest.fileChangesDismissed,
			rest.onKeepAllEdits,
			rest.onRevertAllEdits,
			rest.onKeepFileEdit,
			rest.onRevertFileEdit,
			rest.showScrollToBottomButton,
			rest.scrollMessagesToBottom,
			rest.agentPlanSummaryCard,
		]
	);

	if (import.meta.env.DEV) {
		// 监控 props 重建频率
		console.log(`[perf] useAgentChatPanelProps rebuilt: messages=${rest.displayMessages.length}, thread=${rest.messagesThreadId}`);
	}

	return result;
}
