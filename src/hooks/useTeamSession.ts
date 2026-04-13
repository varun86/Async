import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { applyLiveAgentChatPayload, createEmptyLiveAgentBlocks, type LiveAgentBlocksState } from '../liveAgentBlocks';
import type { ChatMessage } from '../threadTypes';
import type { ChatStreamPayload, TeamRoleScope, TurnTokenUsage } from '../ipcTypes';

export type TeamSessionPhase = 'planning' | 'executing' | 'reviewing' | 'delivering';
export type TeamTaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'revision';
export type TeamRoleType = 'team_lead' | 'frontend' | 'backend' | 'qa' | 'reviewer' | 'custom';

export type TeamTask = {
	id: string;
	expertId: string;
	expertAssignmentKey?: string;
	expertName: string;
	roleType: TeamRoleType;
	description: string;
	status: TeamTaskStatus;
	dependencies: string[];
	acceptanceCriteria?: string[];
	result?: string;
	logs: string[];
};

export type TeamRoleWorkflowState = {
	taskId: string;
	expertId: string;
	expertName: string;
	roleType: TeamRoleType;
	roleKind: 'specialist' | 'reviewer';
	streaming: string;
	streamingThinking: string;
	liveBlocks: LiveAgentBlocksState;
	messages: ChatMessage[];
	lastTurnUsage: TurnTokenUsage | null;
	awaitingReply: boolean;
	lastUpdatedAt: number;
};

export type TeamSessionState = {
	phase: TeamSessionPhase;
	tasks: TeamTask[];
	planSummary: string;
	reviewSummary: string;
	reviewVerdict: 'approved' | 'revision_needed' | null;
	selectedTaskId: string | null;
	reviewerTaskId: string | null;
	roleWorkflowByTaskId: Record<string, TeamRoleWorkflowState>;
	updatedAt: number;
};

function emptySession(): TeamSessionState {
	return {
		phase: 'planning',
		tasks: [],
		planSummary: '',
		reviewSummary: '',
		reviewVerdict: null,
		selectedTaskId: null,
		reviewerTaskId: null,
		roleWorkflowByTaskId: {},
		updatedAt: Date.now(),
	};
}

const MAX_TASK_LOGS = 50;

function ensureRoleWorkflow(
	roleWorkflowByTaskId: Record<string, TeamRoleWorkflowState>,
	scope: TeamRoleScope
): TeamRoleWorkflowState {
	const current = roleWorkflowByTaskId[scope.teamTaskId];
	if (current) {
		current.expertId = scope.teamExpertId;
		current.expertName = scope.teamExpertName;
		current.roleType = scope.teamRoleType;
		current.roleKind = scope.teamRoleKind;
		return current;
	}
	const wf: TeamRoleWorkflowState = {
		taskId: scope.teamTaskId,
		expertId: scope.teamExpertId,
		expertName: scope.teamExpertName,
		roleType: scope.teamRoleType,
		roleKind: scope.teamRoleKind,
		streaming: '',
		streamingThinking: '',
		liveBlocks: createEmptyLiveAgentBlocks(),
		messages: [],
		lastTurnUsage: null,
		awaitingReply: true,
		lastUpdatedAt: Date.now(),
	};
	roleWorkflowByTaskId[scope.teamTaskId] = wf;
	return wf;
}

/**
 * 直接 mutate roleWorkflow（在 ref 中），返回是否需要立即刷新 UI。
 * delta/thinking_delta/tool_input_delta/tool_progress 不需要立即刷新；
 * done/error/tool_call/tool_result 需要立即刷新。
 */
function mutateRoleWorkflowPayload(
	session: TeamSessionState,
	payload: ChatStreamPayload,
	scope: TeamRoleScope
): boolean {
	const wf = ensureRoleWorkflow(session.roleWorkflowByTaskId, scope);
	if (!session.selectedTaskId) {
		session.selectedTaskId = scope.teamTaskId;
	}
	if (scope.teamRoleKind === 'reviewer') {
		session.reviewerTaskId = scope.teamTaskId;
	}

	switch (payload.type) {
		case 'delta':
			wf.streaming += payload.text;
			wf.liveBlocks = applyLiveAgentChatPayload(wf.liveBlocks, { type: 'delta', text: payload.text });
			wf.awaitingReply = true;
			wf.lastUpdatedAt = Date.now();
			return false; // 高频事件，不立即刷新

		case 'thinking_delta':
			wf.streamingThinking += payload.text;
			wf.liveBlocks = applyLiveAgentChatPayload(wf.liveBlocks, { type: 'thinking_delta', text: payload.text });
			wf.awaitingReply = true;
			wf.lastUpdatedAt = Date.now();
			return false;

		case 'tool_input_delta':
			wf.liveBlocks = applyLiveAgentChatPayload(wf.liveBlocks, {
				type: 'tool_input_delta',
				name: payload.name,
				partialJson: payload.partialJson,
				index: payload.index,
			});
			wf.awaitingReply = true;
			wf.lastUpdatedAt = Date.now();
			return false;

		case 'tool_call':
			wf.streaming += `\n<tool_call tool="${payload.name}">${payload.args}</tool_call>\n`;
			wf.liveBlocks = applyLiveAgentChatPayload(wf.liveBlocks, {
				type: 'tool_call',
				name: payload.name,
				args: payload.args,
				toolCallId: payload.toolCallId,
			});
			wf.awaitingReply = true;
			wf.lastUpdatedAt = Date.now();
			return true;

		case 'tool_result': {
			const safe = payload.result.split('</tool_result>').join('</tool\u200c_result>');
			wf.streaming += `<tool_result tool="${payload.name}" success="${payload.success}">${safe}</tool_result>\n`;
			wf.liveBlocks = applyLiveAgentChatPayload(wf.liveBlocks, {
				type: 'tool_result',
				name: payload.name,
				result: payload.result,
				success: payload.success,
				toolCallId: payload.toolCallId,
			});
			wf.awaitingReply = true;
			wf.lastUpdatedAt = Date.now();
			return true;
		}

		case 'tool_progress':
			wf.liveBlocks = applyLiveAgentChatPayload(wf.liveBlocks, {
				type: 'tool_progress',
				name: payload.name,
				phase: payload.phase,
				detail: payload.detail,
			});
			wf.awaitingReply = true;
			wf.lastUpdatedAt = Date.now();
			return false;

		case 'done': {
			const msg: ChatMessage = { role: 'assistant', content: payload.text };
			const lastMsg = wf.messages[wf.messages.length - 1];
			if (!(lastMsg?.role === msg.role && lastMsg?.content === msg.content)) {
				wf.messages = [...wf.messages, msg];
			}
			wf.streaming = '';
			wf.streamingThinking = '';
			wf.liveBlocks = createEmptyLiveAgentBlocks();
			wf.lastTurnUsage = payload.usage ?? wf.lastTurnUsage;
			wf.awaitingReply = false;
			wf.lastUpdatedAt = Date.now();
			return true;
		}

		case 'error': {
			const errMsg: ChatMessage = { role: 'assistant', content: `Error: ${payload.message}` };
			const lastErrMsg = wf.messages[wf.messages.length - 1];
			if (!(lastErrMsg?.role === errMsg.role && lastErrMsg?.content === errMsg.content)) {
				wf.messages = [...wf.messages, errMsg];
			}
			wf.streaming = '';
			wf.streamingThinking = '';
			wf.liveBlocks = createEmptyLiveAgentBlocks();
			wf.awaitingReply = false;
			wf.lastUpdatedAt = Date.now();
			return true;
		}

		default:
			return false;
	}
}

function upsertTask(tasks: TeamTask[], next: TeamTask): TeamTask[] {
	const idx = tasks.findIndex((t) => t.id === next.id);
	if (idx < 0) {
		return [...tasks, next];
	}
	const copy = [...tasks];
	copy[idx] = { ...copy[idx]!, ...next };
	return copy;
}

function clampLogs(logs: string[], entry: string): string[] {
	if (!entry) return logs;
	const next = [...logs, entry];
	return next.length > MAX_TASK_LOGS ? next.slice(-MAX_TASK_LOGS) : next;
}

/** 深拷贝 session 快照到 React state（冻结当前 ref 状态） */
function snapshotSession(session: TeamSessionState): TeamSessionState {
	const rwCopy: Record<string, TeamRoleWorkflowState> = {};
	for (const [k, v] of Object.entries(session.roleWorkflowByTaskId)) {
		rwCopy[k] = { ...v, liveBlocks: { blocks: [...v.liveBlocks.blocks] } };
	}
	return {
		...session,
		tasks: session.tasks.map((t) => ({ ...t, logs: [...t.logs] })),
		roleWorkflowByTaskId: rwCopy,
		updatedAt: Date.now(),
	};
}

const FLUSH_INTERVAL_MS = 200;

export function useTeamSession() {
	const [sessionsByThread, setSessionsByThread] = useState<Record<string, TeamSessionState>>({});

	// mutable ref 持有实时状态；React state 只做定时快照用于渲染
	const sessionsRef = useRef<Record<string, TeamSessionState>>({});
	const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const dirtyThreadsRef = useRef<Set<string>>(new Set());

	const flushDirty = useCallback(() => {
		flushTimerRef.current = null;
		const dirty = dirtyThreadsRef.current;
		if (dirty.size === 0) return;
		const threadIds = [...dirty];
		dirty.clear();
		setSessionsByThread((prev) => {
			const next = { ...prev };
			for (const tid of threadIds) {
				const live = sessionsRef.current[tid];
				if (live) {
					next[tid] = snapshotSession(live);
				} else {
					delete next[tid];
				}
			}
			return next;
		});
	}, []);

	const scheduleFlush = useCallback((threadId: string, immediate: boolean) => {
		dirtyThreadsRef.current.add(threadId);
		if (immediate) {
			if (flushTimerRef.current) {
				clearTimeout(flushTimerRef.current);
				flushTimerRef.current = null;
			}
			flushDirty();
		} else if (!flushTimerRef.current) {
			flushTimerRef.current = setTimeout(flushDirty, FLUSH_INTERVAL_MS);
		}
	}, [flushDirty]);

	// 组件卸载时清理定时器
	useEffect(() => {
		return () => {
			if (flushTimerRef.current) {
				clearTimeout(flushTimerRef.current);
				flushTimerRef.current = null;
			}
		};
	}, []);

	const applyTeamPayload = useCallback((payload: ChatStreamPayload) => {
		if (!payload.threadId) return;
		const threadId = payload.threadId;

		if (!sessionsRef.current[threadId]) {
			sessionsRef.current[threadId] = emptySession();
		}
		const session = sessionsRef.current[threadId]!;

		if (payload.teamRoleScope) {
			const needFlush = mutateRoleWorkflowPayload(session, payload, payload.teamRoleScope);
			session.updatedAt = Date.now();
			scheduleFlush(threadId, needFlush);
			return;
		}

		if (!String(payload.type).startsWith('team_')) return;

		let needFlush = true;
		switch (payload.type) {
			case 'team_phase':
				session.phase = payload.phase;
				break;
			case 'team_task_created': {
				const created: TeamTask = {
					id: payload.task.id,
					expertId: payload.task.expertId,
					expertAssignmentKey: payload.task.expertAssignmentKey,
					expertName: payload.task.expertName,
					roleType: payload.task.roleType,
					description: payload.task.description,
					status: payload.task.status,
					dependencies: payload.task.dependencies ?? [],
					acceptanceCriteria: payload.task.acceptanceCriteria ?? [],
					logs: [],
				};
				session.tasks = upsertTask(session.tasks, created);
				if (!session.selectedTaskId) session.selectedTaskId = created.id;
				break;
			}
			case 'team_expert_started': {
				if (!session.selectedTaskId) session.selectedTaskId = payload.taskId;
				const t = session.tasks.find((x) => x.id === payload.taskId);
				if (t) {
					t.status = 'in_progress';
					t.logs = clampLogs(t.logs, 'Started');
				}
				break;
			}
			case 'team_expert_progress': {
				const detail = payload.message ?? payload.delta ?? '';
				const t = session.tasks.find((x) => x.id === payload.taskId);
				if (t && detail) {
					t.logs = clampLogs(t.logs, detail);
				}
				needFlush = false; // progress 高频，走定时器
				break;
			}
			case 'team_expert_done': {
				const t = session.tasks.find((x) => x.id === payload.taskId);
				if (t) {
					t.status = payload.success ? 'completed' : 'failed';
					t.result = payload.result;
					if (payload.result) t.logs = clampLogs(t.logs, payload.result);
				}
				break;
			}
			case 'team_plan_summary':
				session.planSummary = payload.summary;
				break;
			case 'team_review':
				session.reviewVerdict = payload.verdict;
				session.reviewSummary = payload.summary;
				break;
			default:
				return;
		}
		session.updatedAt = Date.now();
		scheduleFlush(threadId, needFlush);
	}, [scheduleFlush]);

	const setSelectedTask = useCallback((threadId: string, taskId: string | null) => {
		const session = sessionsRef.current[threadId];
		if (session) {
			session.selectedTaskId = taskId;
			session.updatedAt = Date.now();
		}
		setSessionsByThread((prev) => {
			const cur = prev[threadId] ?? emptySession();
			return {
				...prev,
				[threadId]: { ...cur, selectedTaskId: taskId, updatedAt: Date.now() },
			};
		});
	}, []);

	/** abort 时标记所有运行中的 task/workflow 为已停止，避免 CSS 动画和渲染循环 */
	const abortTeamSession = useCallback((threadId: string) => {
		const session = sessionsRef.current[threadId];
		if (!session) return;
		let changed = false;
		for (const task of session.tasks) {
			if (task.status === 'in_progress' || task.status === 'pending') {
				task.status = 'failed';
				if (!task.result) task.result = 'Aborted by user.';
				changed = true;
			}
		}
		for (const wf of Object.values(session.roleWorkflowByTaskId)) {
			if (wf.awaitingReply) {
				wf.awaitingReply = false;
				changed = true;
			}
		}
		if (changed) {
			session.updatedAt = Date.now();
			scheduleFlush(threadId, true);
		}
	}, [scheduleFlush]);

	const clearTeamSession = useCallback((threadId: string) => {
		if (flushTimerRef.current) {
			clearTimeout(flushTimerRef.current);
			flushTimerRef.current = null;
		}
		dirtyThreadsRef.current.delete(threadId);
		delete sessionsRef.current[threadId];
		setSessionsByThread((prev) => {
			if (!prev[threadId]) return prev;
			const next = { ...prev };
			delete next[threadId];
			return next;
		});
	}, []);

	const getTeamSession = useCallback(
		(threadId: string | null): TeamSessionState | null => {
			if (!threadId) return null;
			return sessionsByThread[threadId] ?? null;
		},
		[sessionsByThread]
	);

	return useMemo(
		() => ({
			sessionsByThread,
			applyTeamPayload,
			setSelectedTask,
			clearTeamSession,
			abortTeamSession,
			getTeamSession,
		}),
		[sessionsByThread, applyTeamPayload, setSelectedTask, clearTeamSession, abortTeamSession, getTeamSession]
	);
}
