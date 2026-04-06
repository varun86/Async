import { useCallback } from 'react';
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

	return {
		...rest,
		onOpenWorkspaceFile,
		onOpenAgentConversationFile: onAgentConversationOpenFile,
		onRunCommand,
	};
}
