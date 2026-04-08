import { createContext, useContext, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import type { useSettings } from '../hooks/useSettings';
import type { useWorkspaceManager } from '../hooks/useWorkspaceManager';
import type { useGitIntegration } from '../hooks/useGitIntegration';
import type { AppAppearanceSettings } from '../appearanceSettings';
import type { AppColorMode, ThemeTransitionOrigin } from '../colorMode';
import type { IndexingSettingsState } from '../indexingSettingsTypes';
import type { AppLocale, TFunction } from '../i18n';
import type { ShellLayoutMode } from './shellLayoutStorage';

type SettingsHook = ReturnType<typeof useSettings>;

/** 主题 / i18n / shell 与索引等（与 Git / 工作区 / 模型设置解耦，便于子树按需订阅） */
export type AppShellChromeValue = {
	shell: Window['asyncShell'];
	t: TFunction;
	setLocale: (locale: AppLocale) => void;
	locale: AppLocale;
	ipcOk: string;
	setIpcOk: Dispatch<SetStateAction<string>>;
	indexingSettings: IndexingSettingsState;
	setIndexingSettings: Dispatch<SetStateAction<IndexingSettingsState>>;
	layoutPinnedBySurface: boolean;
	appSurface: ShellLayoutMode | undefined;
	shellLayoutStorageKey: string;
	sidebarLayoutStorageKey: string;
	colorMode: AppColorMode;
	setColorMode: Dispatch<SetStateAction<AppColorMode>>;
	appearanceSettings: AppAppearanceSettings;
	setAppearanceSettings: Dispatch<SetStateAction<AppAppearanceSettings>>;
	effectiveScheme: 'light' | 'dark';
	setTransitionOrigin: (origin?: ThemeTransitionOrigin) => void;
	monacoChromeTheme: 'void-light' | 'void-dark';
};

export type AppShellWorkspaceValue = ReturnType<typeof useWorkspaceManager>;

export type AppShellGitValue = ReturnType<typeof useGitIntegration>;

export type AppShellSettingsValue = Pick<
	SettingsHook,
	| 'modelProviders'
	| 'defaultModel'
	| 'modelEntries'
	| 'enabledModelIds'
	| 'thinkingByModelId'
	| 'setThinkingByModelId'
	| 'hasSelectedModel'
	| 'modelPickerItems'
	| 'modelPillLabel'
	| 'agentCustomization'
	| 'setAgentCustomization'
	| 'refreshWorkspaceDiskSkills'
	| 'mergedAgentCustomization'
	| 'onChangeMergedAgentCustomization'
	| 'editorSettings'
	| 'setEditorSettings'
	| 'mcpServers'
	| 'setMcpServers'
	| 'mcpStatuses'
	| 'setMcpStatuses'
	| 'settingsPageOpen'
	| 'setSettingsPageOpen'
	| 'settingsInitialNav'
	| 'settingsOpenPending'
	| 'onPickDefaultModel'
	| 'onChangeModelEntries'
	| 'onChangeModelProviders'
	| 'onPersistIndexingPatch'
	| 'onRefreshMcpStatuses'
	| 'onStartMcpServer'
	| 'onStopMcpServer'
	| 'onRestartMcpServer'
	| 'applyLoadedSettings'
> & { openSettingsPageBase: SettingsHook['openSettingsPage'] };

export type AppShellFoundationMerged = AppShellChromeValue &
	AppShellWorkspaceValue &
	AppShellGitValue &
	AppShellSettingsValue;

const AppShellChromeContext = createContext<AppShellChromeValue | null>(null);
const AppShellWorkspaceContext = createContext<AppShellWorkspaceValue | null>(null);
const AppShellGitContext = createContext<AppShellGitValue | null>(null);
const AppShellSettingsContext = createContext<AppShellSettingsValue | null>(null);

export function useAppShellChrome(): AppShellChromeValue {
	const v = useContext(AppShellChromeContext);
	if (!v) {
		throw new Error('useAppShellChrome: missing provider');
	}
	return v;
}

export function useAppShellWorkspace(): AppShellWorkspaceValue {
	const v = useContext(AppShellWorkspaceContext);
	if (!v) {
		throw new Error('useAppShellWorkspace: missing provider');
	}
	return v;
}

export function useAppShellGit(): AppShellGitValue {
	const v = useContext(AppShellGitContext);
	if (!v) {
		throw new Error('useAppShellGit: missing provider');
	}
	return v;
}

export function useAppShellSettings(): AppShellSettingsValue {
	const v = useContext(AppShellSettingsContext);
	if (!v) {
		throw new Error('useAppShellSettings: missing provider');
	}
	return v;
}

export function AppShellProviders(props: {
	chrome: AppShellChromeValue;
	workspace: AppShellWorkspaceValue;
	git: AppShellGitValue;
	settings: AppShellSettingsValue;
	children: ReactNode;
}) {
	const { chrome, workspace, git, settings, children } = props;
	return (
		<AppShellChromeContext.Provider value={chrome}>
			<AppShellWorkspaceContext.Provider value={workspace}>
				<AppShellGitContext.Provider value={git}>
					<AppShellSettingsContext.Provider value={settings}>{children}</AppShellSettingsContext.Provider>
				</AppShellGitContext.Provider>
			</AppShellWorkspaceContext.Provider>
		</AppShellChromeContext.Provider>
	);
}
