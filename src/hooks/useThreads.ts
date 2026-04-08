import { useCallback, useLayoutEffect, useRef, useState, startTransition } from 'react';
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

	const [msgState, setMsgState] = useState<{ messages: ChatMessage[]; threadId: string | null }>({
		messages: [],
		threadId: null,
	});
	const messages = msgState.messages;
	const messagesThreadId = msgState.threadId;
	const messagesRef = useRef(messages);
	messagesRef.current = messages;

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
	// 用 useLayoutEffect 而非 useEffect：commit 后立即同步执行，setState 触发的重渲在同一帧内
	// 完成，避免 useEffect 异步调度导致多出一个可见的 paint 周期。
	useLayoutEffect(() => {
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
		// setCurrentId 必须紧急（触发 loadMessages effect 和导航历史更新）。
		// setThreads 是侧栏列表，非紧急，用 transition 避免阻塞消息加载路径。
		setCurrentId(r.currentId);
		startTransition(() => setThreads((r.threads ?? []).map(normalizeThreadRow)));
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
			// sidebar 线程列表是非紧急更新，用 startTransition 避免 IPC 返回后的 132ms 渲染阻塞主线程。
			startTransition(() => setSidebarThreadsByPathKey(next));
		},
		[shell]
	);

	/**
	 * 避免同一线程 ID 的并发 IPC 请求（applyWorkspacePath 直接调用 + effect 间接触发时去重）。
	 */
	const loadingIdRef = useRef<string | null>(null);

	const loadMessages = useCallback(
		async (id: string, onLoad?: (msgs: ChatMessage[], threadId: string) => void) => {
			if (!shell) return;
			// 去重：如果已经在加载同一线程，跳过
			if (loadingIdRef.current === id) return;
			loadingIdRef.current = id;
			const dev = import.meta.env.DEV;
			const tIpcStart = dev && typeof performance !== 'undefined' ? performance.now() : 0;
			try {
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
					// startTransition：消息渲染是非紧急更新，React 可在渲染期间让出主线程给输入事件。
					// 实测 76KB 内容 4 条消息渲染耗时 117ms，不用 transition 会触发 longtask 阻塞窗口拖动。
					// onLoad 在同一 transition 内调用，使 fileChanges / planQuestion 等
					// 状态与 messages 在同一批次渲染，消除 useLayoutEffect 级联的额外 render 轮次。
					startTransition(() => {
						setMsgState({ messages: r.messages!, threadId: id });
						onLoad?.(r.messages!, id);
					});
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
			} finally {
				if (loadingIdRef.current === id) {
					loadingIdRef.current = null;
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
		setMsgState({ messages: [], threadId: null });
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
		setMessages: (msgs: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => {
			setMsgState((prev) => ({
				...prev,
				messages: typeof msgs === 'function' ? msgs(prev.messages) : msgs,
			}));
		},
		messagesRef,
		messagesThreadId,
		setMessagesThreadId: (id: string | null | ((prev: string | null) => string | null)) => {
			setMsgState((prev) => ({
				...prev,
				threadId: typeof id === 'function' ? id(prev.threadId) : id,
			}));
		},
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
