import { useCallback, useEffect, useMemo, useState, startTransition } from 'react';
import type { GitPathStatusMap } from '../WorkspaceExplorer';

type Shell = NonNullable<Window['asyncShell']>;
type DiffPreview = { diff: string; isBinary: boolean; additions: number; deletions: number };

type FullStatusOk = {
	ok: true;
	branch: string;
	lines: string[];
	pathStatus: GitPathStatusMap;
	changedPaths: string[];
	branches: string[];
	current: string;
	previews: Record<string, DiffPreview>;
};

type FullStatusFail = { ok: false; error?: string };

/**
 * 管理所有 Git 相关状态：分支、状态、diff 预览、分支列表。
 * 在 workspace 变化或文件系统触碰时自动刷新。
 */
export function useGitIntegration(shell: Shell | undefined, workspace: string | null) {
	const [gitBranch, setGitBranch] = useState('—');
	const [gitLines, setGitLines] = useState<string[]>([]);
	const [gitPathStatus, setGitPathStatus] = useState<GitPathStatusMap>({});
	const [gitChangedPaths, setGitChangedPaths] = useState<string[]>([]);
	/** `git:status` 成功（有仓库且本机可执行 git）；否则 Agent 改动条回退为对话解析统计 */
	const [gitStatusOk, setGitStatusOk] = useState(false);
	/** 与 refreshGit 同步预取的本地分支列表（供分支选择器立即展示） */
	const [gitBranchList, setGitBranchList] = useState<string[]>([]);
	const [gitBranchListCurrent, setGitBranchListCurrent] = useState('');
	const [diffPreviews, setDiffPreviews] = useState<Record<string, DiffPreview>>({});
	const [diffLoading, setDiffLoading] = useState(false);
	const [gitActionError, setGitActionError] = useState<string | null>(null);
	const [treeEpoch, setTreeEpoch] = useState(0);
	const [gitBranchPickerOpen, setGitBranchPickerOpen] = useState(false);

	const refreshGit = useCallback(async () => {
		if (!shell) {
			return;
		}
		const r = (await shell.invoke('git:fullStatus')) as FullStatusOk | FullStatusFail;
		// 用 startTransition 标记为非紧急更新：React 可在渲染期间让出主线程给鼠标/键盘事件，
		// 防止 git 状态批量 setState 触发的重渲染阻塞窗口拖动和其他 UI 交互。
		if (r.ok) {
			const changedPaths = r.changedPaths ?? [];
			const previews = r.previews ?? {};
			startTransition(() => {
				setGitStatusOk(true);
				setGitBranch(r.branch || 'master');
				setGitLines(r.lines);
				setGitPathStatus(r.pathStatus ?? {});
				setGitChangedPaths(changedPaths);
				setGitBranchList(Array.isArray(r.branches) ? r.branches : []);
				setGitBranchListCurrent(typeof r.current === 'string' ? r.current : '');
				setDiffPreviews(previews);
				setDiffLoading(false);
				setTreeEpoch((n) => n + 1);
			});
		} else {
			startTransition(() => {
				setGitStatusOk(false);
				setGitBranch('—');
				setGitLines([r.error ?? 'Failed to load changes']);
				setGitPathStatus({});
				setGitChangedPaths([]);
				setGitBranchList([]);
				setGitBranchListCurrent('');
				setDiffPreviews({});
				setDiffLoading(false);
				setTreeEpoch((n) => n + 1);
			});
		}
	}, [shell]);

	const onGitBranchListFresh = useCallback((b: string[], c: string) => {
		setGitBranchList(b);
		setGitBranchListCurrent(c);
	}, []);

	// workspace 变化时刷新 git：延后到空闲再跑，避免与切工作区首帧、大组件提交抢主线程（有仓库时一次 fullStatus 含 diff 预览）
	useEffect(() => {
		if (!workspace || !shell) {
			return;
		}
		const idle =
			typeof window.requestIdleCallback === 'function'
				? window.requestIdleCallback.bind(window)
				: (cb: IdleRequestCallback) =>
						window.setTimeout(
							() => cb({ didTimeout: true, timeRemaining: () => 0 } as IdleDeadline),
							1
						);
		const cancel =
			typeof window.cancelIdleCallback === 'function'
				? window.cancelIdleCallback.bind(window)
				: (id: number) => window.clearTimeout(id);
		// 增加 timeout 到 2000ms，给切换工作区后的渲染和交互留出更多时间
		const id = idle(
			() => {
				void refreshGit();
			},
			{ timeout: 2000 }
		);
		return () => cancel(id);
	}, [workspace, shell, refreshGit]);

	const diffTotals = useMemo(() => {
		let additions = 0,
			deletions = 0;
		for (const p of gitChangedPaths) {
			const pr = diffPreviews[p];
			if (pr) {
				additions += pr.additions;
				deletions += pr.deletions;
			}
		}
		return { additions, deletions };
	}, [gitChangedPaths, diffPreviews]);

	/** 资源管理器 Git 视图等：在已有 changedPaths 上单独刷新 diff 预览（与 fullStatus 内建预览互补） */
	const loadGitDiffPreviews = useCallback(async () => {
		if (!shell) {
			return;
		}
		if (gitChangedPaths.length === 0) {
			startTransition(() => {
				setDiffPreviews({});
				setDiffLoading(false);
			});
			return;
		}
		startTransition(() => setDiffLoading(true));
		try {
			const diffR = (await shell.invoke('git:diffPreviews', gitChangedPaths)) as
				| { ok: true; previews: Record<string, DiffPreview> }
				| { ok: false };
			startTransition(() => {
				if (diffR.ok) {
					setDiffPreviews(diffR.previews);
				}
				setDiffLoading(false);
			});
		} catch (e) {
			console.error('[Git] loadGitDiffPreviews:', e);
			startTransition(() => setDiffLoading(false));
		}
	}, [shell, gitChangedPaths]);

	return {
		gitBranch,
		gitLines,
		gitPathStatus,
		gitChangedPaths,
		gitStatusOk,
		gitBranchList,
		gitBranchListCurrent,
		diffPreviews,
		diffLoading,
		gitActionError,
		setGitActionError,
		treeEpoch,
		gitBranchPickerOpen,
		setGitBranchPickerOpen,
		diffTotals,
		refreshGit,
		loadGitDiffPreviews,
		onGitBranchListFresh,
	};
}
