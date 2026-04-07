import { memo, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { changeBadgeLabel, changeBadgeVariant } from './gitBadge';
import { FileTypeIcon } from './fileTypeIcons';
import type { TFunction } from './i18n';
import { IconEye } from './icons';
import type { GitPathStatusMap } from './WorkspaceExplorer';

/** 达到条数后 Agent 侧栏 Git 卡片使用虚拟列表（卡片含 diff，高度由 measureElement 测量） */
export const AGENT_GIT_SCM_VIRTUAL_THRESHOLD = 20;

/** 达到条数后 Editor 侧栏 Git 文件行使用虚拟列表 */
export const EDITOR_GIT_SCM_VIRTUAL_THRESHOLD = 32;

type DiffPreview = { diff: string; isBinary: boolean; additions: number; deletions: number };

function trimGitDiffForSidebarCard(raw: string): string {
	const lines = raw.split('\n');
	const idx = lines.findIndex((l) => l.startsWith('@@'));
	if (idx < 0) {
		return raw;
	}
	const body = lines.slice(idx).filter((l) => !l.startsWith('@@'));
	return body.join('\n');
}

function gitSidebarDiffLineClass(line: string): string {
	const base = 'ref-git-diff-line';
	if (line.startsWith('+') && !line.startsWith('+++')) {
		return `${base} is-add`;
	}
	if (line.startsWith('-') && !line.startsWith('---')) {
		return `${base} is-del`;
	}
	if (
		line.startsWith('diff --git') ||
		line.startsWith('index ') ||
		line.startsWith('--- ') ||
		line.startsWith('+++ ') ||
		line.startsWith('Binary files ') ||
		line.startsWith('GIT binary patch')
	) {
		return `${base} is-meta`;
	}
	return base;
}

function GitDiffLines({ diff, t }: { diff: string; t: TFunction }) {
	const trimmed = trimGitDiffForSidebarCard(diff);
	const lines = trimmed.split('\n').slice(0, 120);
	return (
		<div className="ref-git-card-diff" role="region" aria-label={t('git.diffPreview')}>
			{lines.map((line, i) => {
				const mod = gitSidebarDiffLineClass(line);
				return (
					<div key={i} className={mod}>
						{line || '\u00a0'}
					</div>
				);
			})}
		</div>
	);
}

function AgentGitChangeCard({
	rel,
	pr,
	st,
	diffLoading,
	t,
	onOpenGitDiff,
}: {
	rel: string;
	pr: DiffPreview | undefined;
	st: GitPathStatusMap[string] | undefined;
	diffLoading: boolean;
	t: TFunction;
	onOpenGitDiff: (rel: string, diff: string | null) => void;
}) {
	const badge = st ? changeBadgeLabel(st.label, t) : t('app.gitChangedFallback');
	return (
		<div className="ref-git-card">
			<div className="ref-git-card-head">
				<span className="ref-git-card-name" title={rel}>
					{rel.includes('/') ? rel.slice(rel.lastIndexOf('/') + 1) : rel}
				</span>
				<span className="ref-git-card-badge">{badge}</span>
				<button
					type="button"
					className="ref-git-card-open"
					aria-label={t('app.gitPreviewAria')}
					title={t('app.gitPreviewTitle')}
					onClick={() => onOpenGitDiff(rel, pr?.diff ?? null)}
				>
					<IconEye />
				</button>
			</div>
			<div className="ref-git-card-body">
				{diffLoading && !pr ? <div className="ref-git-card-skel">{t('app.gitDiffLoading')}</div> : null}
				{pr?.isBinary ? <div className="ref-git-binary-msg">{pr.diff || t('app.gitBinary')}</div> : null}
				{pr && !pr.isBinary && pr.diff ? <GitDiffLines diff={pr.diff} t={t} /> : null}
				{pr && !pr.isBinary && !pr.diff ? (
					<div className="ref-git-binary-msg">{t('app.gitNoPreview')}</div>
				) : null}
			</div>
		</div>
	);
}

const AgentGitScmVirtualCards = memo(function AgentGitScmVirtualCards({
	paths,
	diffPreviews,
	gitPathStatus,
	diffLoading,
	t,
	onOpenGitDiff,
}: {
	paths: string[];
	diffPreviews: Record<string, DiffPreview>;
	gitPathStatus: GitPathStatusMap;
	diffLoading: boolean;
	t: TFunction;
	onOpenGitDiff: (rel: string, diff: string | null) => void;
}) {
	const scrollRef = useRef<HTMLDivElement>(null);
	const virtualizer = useVirtualizer({
		count: paths.length,
		getScrollElement: () => scrollRef.current,
		estimateSize: () => 188,
		gap: 10,
		getItemKey: (index) => paths[index]!,
		overscan: 4,
	});
	return (
		<div ref={scrollRef} className="ref-git-changed-scroll">
			<div
				className="ref-git-cards ref-git-cards--virtual"
				style={{
					height: `${virtualizer.getTotalSize()}px`,
					position: 'relative',
					width: '100%',
				}}
			>
				{virtualizer.getVirtualItems().map((vi) => {
					const rel = paths[vi.index]!;
					return (
						<div
							key={vi.key}
							data-index={vi.index}
							ref={virtualizer.measureElement}
							className="ref-git-virtual-card-row"
							style={{
								position: 'absolute',
								top: 0,
								left: 0,
								width: '100%',
								transform: `translateY(${vi.start}px)`,
							}}
						>
							<AgentGitChangeCard
								rel={rel}
								pr={diffPreviews[rel]}
								st={gitPathStatus[rel]}
								diffLoading={diffLoading}
								t={t}
								onOpenGitDiff={onOpenGitDiff}
							/>
						</div>
					);
				})}
			</div>
		</div>
	);
});

export const AgentGitScmChangedCards = memo(function AgentGitScmChangedCards({
	paths,
	diffPreviews,
	gitPathStatus,
	diffLoading,
	t,
	onOpenGitDiff,
}: {
	paths: string[];
	diffPreviews: Record<string, DiffPreview>;
	gitPathStatus: GitPathStatusMap;
	diffLoading: boolean;
	t: TFunction;
	onOpenGitDiff: (rel: string, diff: string | null) => void;
}) {
	if (paths.length >= AGENT_GIT_SCM_VIRTUAL_THRESHOLD) {
		return (
			<AgentGitScmVirtualCards
				paths={paths}
				diffPreviews={diffPreviews}
				gitPathStatus={gitPathStatus}
				diffLoading={diffLoading}
				t={t}
				onOpenGitDiff={onOpenGitDiff}
			/>
		);
	}
	return (
		<div className="ref-git-changed-scroll">
			<div className="ref-git-cards">
				{paths.map((rel) => (
					<AgentGitChangeCard
						key={rel}
						rel={rel}
						pr={diffPreviews[rel]}
						st={gitPathStatus[rel]}
						diffLoading={diffLoading}
						t={t}
						onOpenGitDiff={onOpenGitDiff}
					/>
				))}
			</div>
		</div>
	);
});

const EditorGitScmVirtualRows = memo(function EditorGitScmVirtualRows({
	paths,
	gitPathStatus,
	workspaceBasename,
	editorSidebarSelectedRel,
	onExplorerOpenFile,
	t,
}: {
	paths: string[];
	gitPathStatus: GitPathStatusMap;
	workspaceBasename: string;
	editorSidebarSelectedRel: string;
	onExplorerOpenFile: (rel: string) => void;
	t: TFunction;
}) {
	const scrollRef = useRef<HTMLDivElement>(null);
	const virtualizer = useVirtualizer({
		count: paths.length,
		getScrollElement: () => scrollRef.current,
		estimateSize: () => 40,
		gap: 2,
		getItemKey: (index) => paths[index]!,
		overscan: 8,
	});
	return (
		<div ref={scrollRef} className="ref-editor-sidebar-scroll ref-editor-sidebar-scroll--list">
			<div
				className="ref-editor-sidebar-file-list ref-editor-sidebar-file-list--virtual"
				style={{
					height: `${virtualizer.getTotalSize()}px`,
					position: 'relative',
					width: '100%',
				}}
			>
				{virtualizer.getVirtualItems().map((vi) => {
					const rel = paths[vi.index]!;
					const normalizedRel = rel.replace(/\\/g, '/');
					const fileName = normalizedRel.includes('/')
						? normalizedRel.slice(normalizedRel.lastIndexOf('/') + 1)
						: normalizedRel;
					const dir = normalizedRel.includes('/')
						? normalizedRel.slice(0, normalizedRel.lastIndexOf('/'))
						: workspaceBasename;
					const status = gitPathStatus[rel];
					const label = status?.label ?? '';
					return (
						<div
							key={vi.key}
							data-index={vi.index}
							style={{
								position: 'absolute',
								top: 0,
								left: 0,
								width: '100%',
								transform: `translateY(${vi.start}px)`,
							}}
						>
							<button
								type="button"
								className={`ref-editor-sidebar-file-row ${editorSidebarSelectedRel === normalizedRel ? 'is-active' : ''}`}
								onClick={() => onExplorerOpenFile(rel)}
								title={normalizedRel}
							>
								<span className="ref-editor-sidebar-file-icon" aria-hidden>
									<FileTypeIcon fileName={fileName} isDirectory={false} />
								</span>
								<span className="ref-editor-sidebar-file-main">
									<span className="ref-editor-sidebar-file-name">{fileName}</span>
									<span className="ref-editor-sidebar-file-path">{dir}</span>
								</span>
								<span
									className={`ref-explorer-badge ref-explorer-badge--${changeBadgeVariant(label)}`}
									title={status ? changeBadgeLabel(status.label, t) : t('app.gitChangedFallback')}
								>
									{label || '•'}
								</span>
							</button>
						</div>
					);
				})}
			</div>
		</div>
	);
});

export const EditorGitScmPathList = memo(function EditorGitScmPathList({
	paths,
	gitPathStatus,
	workspaceBasename,
	editorSidebarSelectedRel,
	onExplorerOpenFile,
	t,
}: {
	paths: string[];
	gitPathStatus: GitPathStatusMap;
	workspaceBasename: string;
	editorSidebarSelectedRel: string;
	onExplorerOpenFile: (rel: string) => void;
	t: TFunction;
}) {
	if (paths.length >= EDITOR_GIT_SCM_VIRTUAL_THRESHOLD) {
		return (
			<EditorGitScmVirtualRows
				paths={paths}
				gitPathStatus={gitPathStatus}
				workspaceBasename={workspaceBasename}
				editorSidebarSelectedRel={editorSidebarSelectedRel}
				onExplorerOpenFile={onExplorerOpenFile}
				t={t}
			/>
		);
	}
	return (
		<div className="ref-editor-sidebar-scroll ref-editor-sidebar-scroll--list">
			<div className="ref-editor-sidebar-file-list">
				{paths.map((rel) => {
					const normalizedRel = rel.replace(/\\/g, '/');
					const fileName = normalizedRel.includes('/')
						? normalizedRel.slice(normalizedRel.lastIndexOf('/') + 1)
						: normalizedRel;
					const dir = normalizedRel.includes('/')
						? normalizedRel.slice(0, normalizedRel.lastIndexOf('/'))
						: workspaceBasename;
					const status = gitPathStatus[rel];
					const label = status?.label ?? '';
					return (
						<button
							key={rel}
							type="button"
							className={`ref-editor-sidebar-file-row ${editorSidebarSelectedRel === normalizedRel ? 'is-active' : ''}`}
							onClick={() => onExplorerOpenFile(rel)}
							title={normalizedRel}
						>
							<span className="ref-editor-sidebar-file-icon" aria-hidden>
								<FileTypeIcon fileName={fileName} isDirectory={false} />
							</span>
							<span className="ref-editor-sidebar-file-main">
								<span className="ref-editor-sidebar-file-name">{fileName}</span>
								<span className="ref-editor-sidebar-file-path">{dir}</span>
							</span>
							<span
								className={`ref-explorer-badge ref-explorer-badge--${changeBadgeVariant(label)}`}
								title={status ? changeBadgeLabel(status.label, t) : t('app.gitChangedFallback')}
							>
								{label || '•'}
							</span>
						</button>
					);
				})}
			</div>
		</div>
	);
});
