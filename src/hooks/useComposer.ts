import { useCallback, useEffect, useState, useRef } from 'react';
import { type ComposerMode } from '../ComposerPlusMenu';
import { type ComposerSegment } from '../composerSegments';
import {
	createEmptyLiveAgentBlocks,
	type LiveAgentBlocksState,
} from '../liveAgentBlocks';

const COMPOSER_MODE_KEY = 'async:composer-mode-v1';

function readComposerMode(): ComposerMode {
	try {
		if (typeof window === 'undefined') return 'agent';
		const v = localStorage.getItem(COMPOSER_MODE_KEY);
		if (v === 'agent' || v === 'plan' || v === 'team' || v === 'debug' || v === 'ask') return v;
	} catch {
		/* ignore */
	}
	return 'agent';
}

function writeComposerMode(m: ComposerMode) {
	try {
		localStorage.setItem(COMPOSER_MODE_KEY, m);
	} catch {
		/* ignore */
	}
}

/**
 * 管理 Composer 域状态：输入片段、模式、附件错误、流式预览、live blocks、工具/错误对话框。
 */
export function useComposer() {
	const [composerSegments, setComposerSegments] = useState<ComposerSegment[]>([]);
	/** 内联编辑已发送消息时专用，与底部输入框互不共享 */
	const [inlineResendSegments, setInlineResendSegments] = useState<ComposerSegment[]>([]);

	const [composerMode, setComposerMode] = useState<ComposerMode>(() => readComposerMode());

	// composerMode 变化时持久化
	useEffect(() => {
		writeComposerMode(composerMode);
	}, [composerMode]);

	const [composerAttachErr, setComposerAttachErr] = useState<string | null>(null);
	const composerAttachErrTimerRef = useRef<number | null>(null);

	const [streamingThinking, setStreamingThinking] = useState('');
	const [streamingToolPreview, setStreamingToolPreview] = useState<{
		name: string;
		partialJson: string;
		index: number;
	} | null>(null);
	const streamingToolPreviewClearTimerRef = useRef<number | null>(null);

	const [liveAssistantBlocks, setLiveAssistantBlocks] = useState<LiveAgentBlocksState>(() =>
		createEmptyLiveAgentBlocks()
	);

	const [toolApprovalRequest, setToolApprovalRequest] = useState<{
		approvalId: string;
		toolName: string;
		command?: string;
		path?: string;
	} | null>(null);

	const [mistakeLimitRequest, setMistakeLimitRequest] = useState<{
		recoveryId: string;
		consecutiveFailures: number;
		threshold: number;
	} | null>(null);

	// ── 操作 ──────────────────────────────────────────────────────────────────

	const clearStreamingToolPreviewNow = useCallback(() => {
		if (streamingToolPreviewClearTimerRef.current !== null) {
			window.clearTimeout(streamingToolPreviewClearTimerRef.current);
			streamingToolPreviewClearTimerRef.current = null;
		}
		setStreamingToolPreview(null);
	}, []);

	const resetLiveAgentBlocks = useCallback(() => {
		setLiveAssistantBlocks(createEmptyLiveAgentBlocks());
	}, []);

	const flashComposerAttachErr = useCallback((msg: string) => {
		if (composerAttachErrTimerRef.current !== null) {
			window.clearTimeout(composerAttachErrTimerRef.current);
		}
		setComposerAttachErr(msg);
		composerAttachErrTimerRef.current = window.setTimeout(() => {
			setComposerAttachErr(null);
			composerAttachErrTimerRef.current = null;
		}, 4200);
	}, []);

	/** 切换工作区时重置 Composer 域状态 */
	const resetComposerState = useCallback(() => {
		setComposerSegments([]);
		setInlineResendSegments([]);
		setStreamingThinking('');
		clearStreamingToolPreviewNow();
		resetLiveAgentBlocks();
		setToolApprovalRequest(null);
		setMistakeLimitRequest(null);
	}, [clearStreamingToolPreviewNow, resetLiveAgentBlocks]);

	return {
		composerSegments,
		setComposerSegments,
		inlineResendSegments,
		setInlineResendSegments,
		composerMode,
		setComposerMode,
		composerAttachErr,
		setComposerAttachErr,
		composerAttachErrTimerRef,
		streamingThinking,
		setStreamingThinking,
		streamingToolPreview,
		setStreamingToolPreview,
		streamingToolPreviewClearTimerRef,
		liveAssistantBlocks,
		setLiveAssistantBlocks,
		toolApprovalRequest,
		setToolApprovalRequest,
		mistakeLimitRequest,
		setMistakeLimitRequest,
		clearStreamingToolPreviewNow,
		resetLiveAgentBlocks,
		flashComposerAttachErr,
		resetComposerState,
	};
}
