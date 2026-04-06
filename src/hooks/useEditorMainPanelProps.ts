import { useCallback, type Dispatch, type SetStateAction } from 'react';
import type { EditorMainPanelProps } from '../EditorMainPanel';
import type { EditorTab } from '../EditorTabBar';

export type UseEditorMainPanelPropsParams = Omit<
	EditorMainPanelProps,
	| 'openWorkspacePicker'
	| 'onEditorValueChange'
	| 'onLoadFile'
	| 'onSaveFile'
	| 'appendEditorTerminal'
	| 'onSelectTab'
> & {
	setWorkspacePickerOpen: Dispatch<SetStateAction<boolean>>;
	onLoadFile: () => void | Promise<void>;
	onSaveFile: () => void | Promise<void>;
	appendEditorTerminal: (opts?: { cwdRel?: string }) => void | Promise<void>;
	onSelectTab: (id: string) => void | Promise<void>;
	setEditorValue: Dispatch<SetStateAction<string>>;
	setOpenTabs: Dispatch<SetStateAction<EditorTab[]>>;
};

export function useEditorMainPanelProps({
	setWorkspacePickerOpen,
	onLoadFile: onLoadFileIn,
	onSaveFile: onSaveFileIn,
	appendEditorTerminal: appendEditorTerminalIn,
	setEditorValue,
	setOpenTabs,
	onSelectTab: onSelectTabIn,
	...editorRest
}: UseEditorMainPanelPropsParams): EditorMainPanelProps {
	const openWorkspacePicker = useCallback(() => setWorkspacePickerOpen(true), [setWorkspacePickerOpen]);

	const onLoadFile = useCallback(() => {
		void onLoadFileIn();
	}, [onLoadFileIn]);

	const onSaveFile = useCallback(() => {
		void onSaveFileIn();
	}, [onSaveFileIn]);

	const appendEditorTerminal = useCallback(() => {
		void appendEditorTerminalIn();
	}, [appendEditorTerminalIn]);

	const onSelectTab = useCallback(
		(id: string) => {
			void onSelectTabIn(id);
		},
		[onSelectTabIn]
	);

	const onEditorValueChange = useCallback(
		(value: string) => {
			setEditorValue(value);
			const fp = editorRest.filePath.trim();
			setOpenTabs((prev) => prev.map((tab) => (tab.filePath === fp ? { ...tab, dirty: true } : tab)));
		},
		[setEditorValue, setOpenTabs, editorRest.filePath]
	);

	return {
		...editorRest,
		openWorkspacePicker,
		onLoadFile,
		onSaveFile,
		appendEditorTerminal,
		onSelectTab,
		onEditorValueChange,
	};
}
