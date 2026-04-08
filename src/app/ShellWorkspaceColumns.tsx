import {
	memo,
	type ComponentProps,
	type Dispatch,
	type KeyboardEvent,
	type ReactNode,
	type RefObject,
	type SetStateAction,
} from 'react';
import { AgentLeftSidebar, type AgentLeftSidebarProps } from '../AgentLeftSidebar';
import { AgentRightSidebar } from '../AgentRightSidebar';
import { AgentChatPanel, type AgentChatPanelProps } from '../AgentChatPanel';
import { EditorLeftSidebar } from '../EditorLeftSidebar';
import {
	IconCloseSmall,
	IconDotsHorizontal,
	IconHistory,
	IconPlus,
	IconSearch,
} from '../icons';
import type { TFunction } from '../i18n';
import type { ThreadInfo } from '../threadTypes';
import type { ComposerMode } from '../ComposerPlusMenu';
import { threadRowTitle } from './threadRowUi';
import type { ShellLayoutMode } from './shellLayoutStorage';

export type ShellLeftRailGroupProps = {
	layoutMode: ShellLayoutMode;
	leftSidebarOpen: boolean;
	t: TFunction;
	beginResizeLeft: (e: React.MouseEvent) => void;
	resetRailWidths: () => void;
	agentLeftSidebarProps: AgentLeftSidebarProps;
	editorLeftSidebarProps: ComponentProps<typeof EditorLeftSidebar>;
};

/**
 * 左侧栏 + 左分隔条；display:contents 使子节点仍参与 ref-body 的 grid 布局。
 * memo：流式输出时 agentLeftSidebarProps 通常不变，可跳过左侧整栏 reconcile。
 */
export const ShellLeftRailGroup = memo(function ShellLeftRailGroup({
	layoutMode,
	leftSidebarOpen,
	t,
	beginResizeLeft,
	resetRailWidths,
	agentLeftSidebarProps,
	editorLeftSidebarProps,
}: ShellLeftRailGroupProps) {
	return (
		<div className="ref-shell-left-rail-group" style={{ display: 'contents' }}>
			<aside
				className={`ref-left ${leftSidebarOpen ? '' : 'is-collapsed'} ${
					layoutMode === 'editor' ? 'ref-left--editor-embedded' : 'ref-left--agent-layout'
				}`}
				aria-label={t('app.projectAndAgent')}
			>
				{layoutMode === 'agent' ? (
					<AgentLeftSidebar {...agentLeftSidebarProps} />
				) : (
					<EditorLeftSidebar {...editorLeftSidebarProps} />
				)}
			</aside>

			<div
				className={`ref-resize-handle ${leftSidebarOpen ? '' : 'is-collapsed'}`}
				role="separator"
				aria-orientation="vertical"
				aria-label={t('app.resizeLeftAria')}
				title={t('app.resizeLeftTitle')}
				onMouseDown={leftSidebarOpen ? beginResizeLeft : undefined}
				onDoubleClick={resetRailWidths}
			/>
		</div>
	);
});

export type ShellCenterRightGroupProps = {
	layoutMode: ShellLayoutMode;
	agentRightSidebarOpen: boolean;
	t: TFunction;
	/** 中间主栏：Agent 为 AgentAgentCenterColumn，Editor 为 Suspense+EditorMainPanel（由父组件懒加载） */
	centerMain: ReactNode;
	hasConversation: boolean;
	onPlanNewIdea: (e: KeyboardEvent) => void;
	agentChatPanelProps: Omit<AgentChatPanelProps, 'layout'>;
	agentRightSidebarProps: ComponentProps<typeof AgentRightSidebar>;
	beginResizeRight: (e: React.MouseEvent) => void;
	resetRailWidths: () => void;
	threadsChrono: ThreadInfo[];
	currentId: string | null;
	onSelectThread: (id: string, threadListWorkspace?: string | null) => void | Promise<void>;
	confirmDeleteId: string | null;
	onDeleteThread: (e: React.MouseEvent, id: string, threadListWorkspace?: string | null) => void | Promise<void>;
	editorThreadHistoryOpen: boolean;
	setEditorThreadHistoryOpen: Dispatch<SetStateAction<boolean>>;
	editorChatMoreOpen: boolean;
	setEditorChatMoreOpen: Dispatch<SetStateAction<boolean>>;
	editorHistoryMenuRef: RefObject<HTMLDivElement | null>;
	editorMoreMenuRef: RefObject<HTMLDivElement | null>;
	threadSearch: string;
	setThreadSearch: Dispatch<SetStateAction<string>>;
	todayThreads: ThreadInfo[];
	archivedThreads: ThreadInfo[];
	renderThreadItem: (th: ThreadInfo, threadListWorkspace?: string | null) => ReactNode;
	setComposerModePersist: (mode: ComposerMode) => void;
	onNewThread: () => void | Promise<void>;
	setWorkspaceToolsOpen: Dispatch<SetStateAction<boolean>>;
	handleCloseEditorChatMore: () => void;
	handleOpenSettingsGeneral: () => void;
};

/**
 * 中间主栏 + 右分隔条 + 右侧栏；display:contents 保持五列 grid。
 * 与左侧解耦：仅此处随消息流式、diff 等高频 props 变化而重渲。
 */
export const ShellCenterRightGroup = memo(function ShellCenterRightGroup({
	layoutMode,
	agentRightSidebarOpen,
	t,
	centerMain,
	hasConversation,
	onPlanNewIdea,
	agentChatPanelProps,
	agentRightSidebarProps,
	beginResizeRight,
	resetRailWidths,
	threadsChrono,
	currentId,
	onSelectThread,
	confirmDeleteId,
	onDeleteThread,
	editorThreadHistoryOpen,
	setEditorThreadHistoryOpen,
	editorChatMoreOpen,
	setEditorChatMoreOpen,
	editorHistoryMenuRef,
	editorMoreMenuRef,
	threadSearch,
	setThreadSearch,
	todayThreads,
	archivedThreads,
	renderThreadItem,
	setComposerModePersist,
	onNewThread,
	setWorkspaceToolsOpen,
	handleCloseEditorChatMore,
	handleOpenSettingsGeneral,
}: ShellCenterRightGroupProps) {
	return (
		<div className="ref-shell-center-right-group" style={{ display: 'contents' }}>
			{centerMain}

			<div
				className={`ref-resize-handle ${
					layoutMode === 'agent' && !agentRightSidebarOpen ? 'is-collapsed' : ''
				}`}
				role="separator"
				aria-orientation="vertical"
				aria-label={t('app.resizeRightAria')}
				title={t('app.resizeRightTitle')}
				onMouseDown={layoutMode === 'agent' && !agentRightSidebarOpen ? undefined : beginResizeRight}
				onDoubleClick={resetRailWidths}
			/>

			{layoutMode === 'agent' ? (
				<AgentRightSidebar {...agentRightSidebarProps} />
			) : (
				<aside
					className={`ref-right ref-right--editor-chat ref-right--editor-shell ${hasConversation ? 'ref-right--editor-chat--active' : ''}`}
					aria-label={t('app.editorAgentChatRail')}
					onKeyDown={onPlanNewIdea}
				>
					<div className="ref-editor-chat-panel">
						<div className="ref-editor-chat-tab-rail">
							<nav
								className="ref-editor-chat-tabs-scroll"
								aria-label={t('app.editorChatTabListAria')}
							>
								{threadsChrono.map((th) => {
									const active = th.id === currentId;
									return (
										<div
											key={th.id}
											className={`ref-editor-chat-tab-shell ${active ? 'is-active' : ''}`}
										>
											<button
												type="button"
												className="ref-editor-chat-tab-main"
												aria-current={active ? 'true' : undefined}
												title={threadRowTitle(t, th)}
												onClick={() => {
													setEditorThreadHistoryOpen(false);
													void onSelectThread(th.id);
												}}
											>
												<span className="ref-editor-chat-tab-label">{threadRowTitle(t, th)}</span>
											</button>
											<button
												type="button"
												className={`ref-editor-chat-tab-close ${
													confirmDeleteId === th.id ? 'ref-editor-chat-tab-close--confirm' : ''
												}`}
												title={
													confirmDeleteId === th.id ? t('common.confirmDelete') : t('common.deleteThread')
												}
												aria-label={
													confirmDeleteId === th.id ? t('common.confirmDelete') : t('common.deleteThread')
												}
												onClick={(e) => void onDeleteThread(e, th.id)}
											>
												{confirmDeleteId === th.id ? (
													<span className="ref-editor-chat-tab-close-confirm-label">{t('common.confirm')}</span>
												) : (
													<IconCloseSmall className="ref-editor-chat-tab-close-svg" />
												)}
											</button>
										</div>
									);
								})}
							</nav>
							<div className="ref-editor-chat-tab-actions">
								<button
									type="button"
									className="ref-editor-chat-icon-btn"
									title={t('app.newAgent')}
									aria-label={t('app.newAgent')}
									onClick={() => {
										setEditorThreadHistoryOpen(false);
										setEditorChatMoreOpen(false);
										void onNewThread();
									}}
								>
									<IconPlus className="ref-editor-chat-icon-btn-svg" />
								</button>
								<div className="ref-editor-chat-menu-wrap" ref={editorHistoryMenuRef}>
									<button
										type="button"
										className={`ref-editor-chat-icon-btn ${editorThreadHistoryOpen ? 'is-active' : ''}`}
										title={t('app.editorChatHistoryAria')}
										aria-label={t('app.editorChatHistoryAria')}
										aria-expanded={editorThreadHistoryOpen}
										aria-haspopup="dialog"
										onClick={() => {
											setEditorChatMoreOpen(false);
											setEditorThreadHistoryOpen((o) => !o);
										}}
									>
										<IconHistory className="ref-editor-chat-icon-btn-svg" />
									</button>
									{editorThreadHistoryOpen ? (
										<div className="ref-editor-chat-dropdown ref-editor-chat-dropdown--history" role="dialog">
											<label className="ref-editor-chat-history-search">
												<IconSearch className="ref-editor-chat-history-search-ico" aria-hidden />
												<input
													type="search"
													className="ref-editor-chat-history-input"
													placeholder={t('app.editorChatSearchThreads')}
													value={threadSearch}
													onChange={(e) => setThreadSearch(e.target.value)}
													aria-label={t('app.editorChatSearchThreads')}
												/>
											</label>
											<div className="ref-editor-chat-history-section-label">{t('app.today')}</div>
											<div className="ref-editor-chat-history-list">
												{todayThreads.map((th) => renderThreadItem(th))}
											</div>
											{archivedThreads.length > 0 ? (
												<>
													<div className="ref-editor-chat-history-section-label ref-editor-chat-history-section-label--arch">
														{t('app.archived')}
													</div>
													<div className="ref-editor-chat-history-list">
														{archivedThreads.map((th) => renderThreadItem(th))}
													</div>
												</>
											) : null}
										</div>
									) : null}
								</div>
								<div className="ref-editor-chat-menu-wrap" ref={editorMoreMenuRef}>
									<button
										type="button"
										className={`ref-editor-chat-icon-btn ${editorChatMoreOpen ? 'is-active' : ''}`}
										title={t('app.editorChatMoreAria')}
										aria-label={t('app.editorChatMoreAria')}
										aria-expanded={editorChatMoreOpen}
										aria-haspopup="menu"
										onClick={() => {
											setEditorThreadHistoryOpen(false);
											setEditorChatMoreOpen((o) => !o);
										}}
									>
										<IconDotsHorizontal className="ref-editor-chat-icon-btn-svg" />
									</button>
									{editorChatMoreOpen ? (
										<div className="ref-editor-chat-dropdown ref-editor-chat-dropdown--more" role="menu">
											<button
												type="button"
												className="ref-editor-chat-more-item"
												role="menuitem"
												onClick={() => {
													setEditorChatMoreOpen(false);
													setComposerModePersist('plan');
													void onNewThread();
												}}
											>
												{t('app.planNewIdea')}
											</button>
											<button
												type="button"
												className="ref-editor-chat-more-item"
												role="menuitem"
												onClick={() => {
													setEditorChatMoreOpen(false);
													setWorkspaceToolsOpen(true);
												}}
											>
												{t('app.quickTerminal')}
											</button>
											<button
												type="button"
												className="ref-editor-chat-more-item"
												role="menuitem"
												onClick={() => {
													handleCloseEditorChatMore();
													handleOpenSettingsGeneral();
												}}
											>
												{t('app.settings')}
											</button>
										</div>
									) : null}
								</div>
							</div>
						</div>
						<AgentChatPanel layout="editor-rail" {...agentChatPanelProps} />
					</div>
				</aside>
			)}
		</div>
	);
});
