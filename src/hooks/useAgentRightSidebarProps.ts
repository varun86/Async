import { useCallback, type Dispatch, type SetStateAction } from 'react';
import type { AgentRightSidebarProps } from '../AgentRightSidebar';

export type UseAgentRightSidebarPropsParams = Omit<
	AgentRightSidebarProps,
	'closeSidebar' | 'onOpenGitDiff' | 'openView'
> & {
	openAgentRightSidebarView: AgentRightSidebarProps['openView'];
	setAgentRightSidebarOpen: Dispatch<SetStateAction<boolean>>;
	onExplorerOpenFile: (
		rel: string,
		revealLine?: number,
		revealEndLine?: number,
		options?: { diff?: string | null; allowReviewActions?: boolean }
	) => void | Promise<void>;
};

export function useAgentRightSidebarProps(p: UseAgentRightSidebarPropsParams): AgentRightSidebarProps {
	const { onExplorerOpenFile, setAgentRightSidebarOpen, openAgentRightSidebarView, ...rest } = p;

	const closeSidebar = useCallback(() => {
		setAgentRightSidebarOpen(false);
	}, [setAgentRightSidebarOpen]);

	const onOpenGitDiff = useCallback(
		(rel: string, diff: string | null) => {
			void onExplorerOpenFile(rel, undefined, undefined, { diff, allowReviewActions: true });
		},
		[onExplorerOpenFile]
	);

	return {
		...rest,
		openView: openAgentRightSidebarView,
		closeSidebar,
		onOpenGitDiff,
	};
}
