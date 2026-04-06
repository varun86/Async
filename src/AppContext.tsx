import { createContext, useContext, type ReactNode } from 'react';
import type { TFunction } from './i18n';

export interface AppContextValue {
	shell: NonNullable<Window['asyncShell']> | undefined;
	workspace: string | null;
	t: TFunction;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({
	shell,
	workspace,
	t,
	children,
}: AppContextValue & { children: ReactNode }) {
	return (
		<AppContext.Provider value={{ shell, workspace, t }}>
			{children}
		</AppContext.Provider>
	);
}

export function useAppContext(): AppContextValue {
	const ctx = useContext(AppContext);
	if (!ctx) {
		throw new Error('useAppContext must be used within AppProvider');
	}
	return ctx;
}
