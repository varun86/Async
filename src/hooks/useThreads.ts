import { useCallback, useEffect, useRef, useState } from 'react';
import { type ChatMessage, type ThreadInfo, normalizeThreadRow } from '../threadTypes';
import { normWorkspaceRootKey } from '../workspaceRootKey';

type Shell = NonNullable<Window['asyncShell']>;

/**
 * 管理线程列表、当前线程、消息及导航历史。
 * 暴露 resetThreadState() 供切换工作区时统一清空。
 */
export function useThreads(shell: Shell | undefined) {
	const [threads, setThreads] = useState<ThreadInfo[]>([]);
	const [threadSearch, setThreadSearch] = useState('');
	const [currentId, setCurrentId] = useState<string | null>(null);
	const currentIdRef = useRef<string | null>(null);
	currentIdRef.current = currentId;

	const [editingThreadId, setEditingThreadId] = useState<string | null>(null);
	const [editingThreadTitleDraft, setEditingThreadTitleDraft] = useState('');
	const threadTitleDraftRef = useRef('');
	const threadTitleInputRef = useRef<HTMLInputElement>(null);

	const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
	const confirmDeleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const messagesRef = useRef(messages);
	messagesRef.current = messages;
	const [messagesThreadId, setMessagesThreadId] = useState<string | null>(null);

	/** Agent 侧栏：按工作区根路径归一化键索引的线程摘要（非当前工作区不经过 threads:list） */
	const [sidebarThreadsByPathKey, setSidebarThreadsByPathKey] = useState<Record<string, ThreadInfo[]>>({});
	const sidebarFetchGenRef = useRef(0);

	const [resendFromUserIndex, setResendFromUserIndex] = useState<number | null>(null);
	const resendIdxRef = useRef<number | null>(null);
	resendIdxRef.current = resendFromUserIndex;

	const [threadNavigation, setThreadNavigation] = useState<{ history: string[]; index: number }>({
		history: [],
		index: -1,
	});
	const skipThreadNavigationRecordRef = useRef(false);

	// currentId 变化时更新导航历史
	useEffect(() => {
		if (!currentId) return;
		if (skipThreadNavigationRecordRef.current) {
			skipThreadNavigationRecordRef.current = false;
			return;
		}
		setThreadNavigation((prev) => {
			const base = prev.index >= 0 ? prev.history.slice(0, prev.index + 1) : [];
			if (base[base.length - 1] === currentId) return prev;
			const history = [...base, currentId].slice(-40);
			return { history, index: history.length - 1 };
		});
	}, [currentId]);

	// ── 操作 ──────────────────────────────────────────────────────────────────

	const refreshThreads = useCallback(async () => {
		if (!shell) return null;
		const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
		const r = (await shell.invoke('threads:list')) as {
			threads: ThreadInfo[];
			currentId: string | null;
		};
		setThreads((r.threads ?? []).map(normalizeThreadRow));
		setCurrentId(r.currentId);
		if (t0 && typeof performance !== 'undefined') {
			console.log(`[perf] refreshThreads: ${(performance.now() - t0).toFixed(1)}ms`);
		}
		return r.currentId;
	}, [shell]);

	const refreshAgentSidebarThreads = useCallback(
		async (paths: string[]) => {
			if (!shell) {
				return;
			}
			const gen = ++sidebarFetchGenRef.current;
			if (paths.length === 0) {
				setSidebarThreadsByPathKey({});
				return;
			}
			const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
			const r = (await shell.invoke('threads:listAgentSidebar', paths)) as {
				workspaces?: Array<{ requestedPath: string; resolvedPath: string | null; threads: ThreadInfo[] }>;
			};
			if (t0 && typeof performance !== 'undefined') {
				console.log(`[perf] refreshAgentSidebarThreads: ${(performance.now() - t0).toFixed(1)}ms`);
			}
			if (gen !== sidebarFetchGenRef.current) {
				return;
			}
			const next: Record<string, ThreadInfo[]> = {};
			for (const w of r.workspaces ?? []) {
				const keySource = w.resolvedPath ?? w.requestedPath;
				if (!keySource) {
					continue;
				}
				next[normWorkspaceRootKey(keySource)] = (w.threads ?? []).map(normalizeThreadRow);
			}
			setSidebarThreadsByPathKey(next);
		},
		[shell]
	);

	const loadMessages = useCallback(
		async (id: string) => {
			if (!shell) return;
			const dev = import.meta.env.DEV;
			const tIpcStart = dev && typeof performance !== 'undefined' ? performance.now() : 0;
			const r = (await shell.invoke('threads:messages', id)) as {
				ok: boolean;
				messages?: ChatMessage[];
			};
			const tIpcEnd = dev && typeof performance !== 'undefined' ? performance.now() : 0;
			if (dev && tIpcStart) {
				console.log(`[perf] loadMessages: ipc=${(tIpcEnd - tIpcStart).toFixed(1)}ms`);
			}
			if (r.ok && r.messages) {
				if (currentIdRef.current !== id) {
					if (dev) {
						console.log(
							`[perf] loadMessages: stale ignored (wanted ${id}, currentId=${currentIdRef.current})`
						);
					}
					return;
				}
				if (dev && typeof performance !== 'undefined') {
					let approxContentChars = 0;
					for (const m of r.messages) {
						if (typeof m.content === 'string') {
							approxContentChars += m.content.length;
						}
					}
					console.log(
						`[perf] loadMessages: payload messages=${r.messages.length}, approxContentChars=${approxContentChars}`
					);
				}
				setMessages(r.messages);
				setMessagesThreadId(id);
				if (dev && typeof performance !== 'undefined') {
					const ipcEnd = tIpcEnd;
					queueMicrotask(() => {
						console.log(
							`[perf] loadMessages: microtask Δ=${(performance.now() - ipcEnd).toFixed(1)}ms after ipc (before paint)`
						);
					});
					requestAnimationFrame(() => {
						requestAnimationFrame(() => {
							console.log(
								`[perf] loadMessages: toPaint Δ=${(performance.now() - ipcEnd).toFixed(1)}ms after ipc (≈after frame)`
							);
						});
					});
				}
			}
		},
		[shell]
	);

	/** 切换工作区时重置线程域的所有状态 */
	const resetThreadState = useCallback(() => {
		currentIdRef.current = null;
		setThreads([]);
		setCurrentId(null);
		setMessages([]);
		setMessagesThreadId(null);
		setResendFromUserIndex(null);
		setConfirmDeleteId(null);
		setEditingThreadId(null);
		setEditingThreadTitleDraft('');
		threadTitleDraftRef.current = '';
		setThreadNavigation({ history: [], index: -1 });
		sidebarFetchGenRef.current++;
		setSidebarThreadsByPathKey({});
	}, []);

	return {
		threads,
		setThreads,
		threadSearch,
		setThreadSearch,
		currentId,
		setCurrentId,
		currentIdRef,
		editingThreadId,
		setEditingThreadId,
		editingThreadTitleDraft,
		setEditingThreadTitleDraft,
		threadTitleDraftRef,
		threadTitleInputRef,
		confirmDeleteId,
		setConfirmDeleteId,
		confirmDeleteTimerRef,
		messages,
		setMessages,
		messagesRef,
		messagesThreadId,
		setMessagesThreadId,
		resendFromUserIndex,
		setResendFromUserIndex,
		resendIdxRef,
		threadNavigation,
		setThreadNavigation,
		skipThreadNavigationRecordRef,
		refreshThreads,
		refreshAgentSidebarThreads,
		sidebarThreadsByPathKey,
		loadMessages,
		resetThreadState,
	};
}
