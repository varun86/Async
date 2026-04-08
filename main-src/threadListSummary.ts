import type { ChatMessage } from './threadStore.js';
import { listAgentDiffChunks } from './agent/applyAgentDiffs.js';
import { flattenAssistantTextPartsForSearch } from '../src/agentStructuredMessage.js';
import { countDiffLinesInChunk } from './diffLineCount.js';

export type ThreadRowSummary = {
	/** 末条为用户且其后无助手回复 → 进行中 / 草稿样式 */
	isAwaitingReply: boolean;
	/** 末条助手是否含可解析的 diff */
	hasAgentDiff: boolean;
	additions: number;
	deletions: number;
	filePaths: string[];
	/** diff 块数量（路径解析失败时仍用于「N Files」） */
	fileCount: number;
	/** 副标题：无 diff 时用助手/用户首行摘要 */
	subtitleFallback: string;
};

function visibleMessages(msgs: ChatMessage[]): ChatMessage[] {
	return msgs.filter((m) => m.role !== 'system');
}

function firstLine(text: string, maxLen: number): string {
	const line = text.replace(/\r\n/g, '\n').split('\n')[0]?.trim() ?? '';
	return line.length > maxLen ? `${line.slice(0, maxLen)}…` : line;
}

const summaryCache = new Map<string, { updatedAt: number; summary: ThreadRowSummary }>();

/** Maximum number of cached thread summaries to prevent unbounded memory growth. */
const SUMMARY_CACHE_MAX = 500;

// diff 扫描只看消息末尾 N 个字符：最近的 diff 在末尾，扫全文对长消息代价极高。
const DIFF_SCAN_MAX_CHARS = 30_000;
// subtitle 只取消息开头 N 个字符即可提取首行。
const SUBTITLE_HEAD_MAX_CHARS = 2_000;

function computeThreadRowSummary(thread: { messages: ChatMessage[] }): ThreadRowSummary {
	const vis = visibleMessages(thread.messages);
	const last = vis[vis.length - 1];
	const prev = vis.length >= 2 ? vis[vis.length - 2] : undefined;

	const isAwaitingReply = last?.role === 'user';

	let lastAssistantRaw = '';
	for (let i = vis.length - 1; i >= 0; i--) {
		if (vis[i]!.role === 'assistant') {
			lastAssistantRaw = vis[i]!.content;
			break;
		}
	}

	// flattenAssistantTextPartsForSearch 需要完整 JSON 才能解析结构化消息，
	// 截断放在 flatten 之后（已是纯文本）。
	const lastAssistantText = flattenAssistantTextPartsForSearch(lastAssistantRaw);

	// 只扫末尾 30 KB 以检测 diff：防止超长消息阻塞主进程事件循环。
	const textForDiff = lastAssistantText.length > DIFF_SCAN_MAX_CHARS
		? lastAssistantText.slice(-DIFF_SCAN_MAX_CHARS)
		: lastAssistantText;
	const chunks = textForDiff ? listAgentDiffChunks(textForDiff) : [];
	const paths = [...new Set(chunks.map((c) => c.relPath).filter((p): p is string => !!p?.trim()))];

	let additions = 0;
	let deletions = 0;
	for (const c of chunks) {
		const { add, del } = countDiffLinesInChunk(c.chunk);
		additions += add;
		deletions += del;
	}

	const hasAgentDiff = chunks.length > 0;
	const fileCount = Math.max(paths.length, chunks.length);

	// subtitle 只需开头 2 KB。
	const textForSubtitle = lastAssistantText.length > SUBTITLE_HEAD_MAX_CHARS
		? lastAssistantText.slice(0, SUBTITLE_HEAD_MAX_CHARS)
		: lastAssistantText;

	let subtitleFallback = '';
	if (isAwaitingReply && last?.role === 'user') {
		subtitleFallback = firstLine(last.content, 72);
	} else if (lastAssistantRaw) {
		const stripped = textForSubtitle.replace(/```[\s\S]*?```/g, ' ').trim();
		subtitleFallback = firstLine(stripped, 72);
	}
	if (!subtitleFallback && last?.role === 'user') {
		subtitleFallback = firstLine(last.content, 72);
	}
	if (!subtitleFallback && prev?.role === 'user') {
		subtitleFallback = firstLine(prev.content, 72);
	}

	return {
		isAwaitingReply,
		hasAgentDiff,
		additions,
		deletions,
		filePaths: paths,
		fileCount,
		subtitleFallback,
	};
}

export function summarizeThreadForSidebar(thread: {
	id: string;
	updatedAt: number;
	messages: ChatMessage[];
}): ThreadRowSummary {
	const cached = summaryCache.get(thread.id);
	if (cached && cached.updatedAt === thread.updatedAt) {
		return cached.summary;
	}
	const summary = computeThreadRowSummary(thread);
	summaryCache.set(thread.id, { updatedAt: thread.updatedAt, summary });
	// Evict oldest entries when cache exceeds max size (simple FIFO via Map insertion order).
	if (summaryCache.size > SUMMARY_CACHE_MAX) {
		const first = summaryCache.keys().next().value;
		if (first !== undefined) summaryCache.delete(first);
	}
	return summary;
}

/**
 * Remove cached summaries for thread IDs that no longer exist.
 * Call after listing threads to keep the cache consistent with storage.
 */
export function pruneSummaryCache(activeIds: ReadonlySet<string>): void {
	for (const id of summaryCache.keys()) {
		if (!activeIds.has(id)) {
			summaryCache.delete(id);
		}
	}
}

export function isTimestampToday(ts: number, now = Date.now()): boolean {
	const d = new Date(ts);
	const n = new Date(now);
	return (
		d.getFullYear() === n.getFullYear() &&
		d.getMonth() === n.getMonth() &&
		d.getDate() === n.getDate()
	);
}
