import { useCallback, useReducer } from 'react';

export type MenubarMenuId = 'file' | 'edit' | 'view' | 'window' | 'terminal';

export type MenubarMenuState = Record<MenubarMenuId, boolean>;

const ALL_CLOSED: MenubarMenuState = {
	file: false,
	edit: false,
	view: false,
	window: false,
	terminal: false,
};

type Action =
	| { type: 'toggleExclusive'; id: MenubarMenuId }
	| { type: 'set'; id: MenubarMenuId; open: boolean };

function reducer(state: MenubarMenuState, action: Action): MenubarMenuState {
	switch (action.type) {
		case 'toggleExclusive': {
			if (state[action.id]) {
				return ALL_CLOSED;
			}
			return { ...ALL_CLOSED, [action.id]: true };
		}
		case 'set': {
			if (!action.open) {
				return state[action.id] ? { ...state, [action.id]: false } : state;
			}
			return { ...ALL_CLOSED, [action.id]: true };
		}
		default:
			return state;
	}
}

export function useMenubarMenuReducer() {
	const [menus, dispatch] = useReducer(reducer, ALL_CLOSED);

	const toggleMenubarMenu = useCallback((id: MenubarMenuId) => {
		dispatch({ type: 'toggleExclusive', id });
	}, []);

	const setMenubarMenu = useCallback((id: MenubarMenuId, open: boolean) => {
		dispatch({ type: 'set', id, open });
	}, []);

	const setTerminalMenuOpen = useCallback((open: boolean) => {
		dispatch({ type: 'set', id: 'terminal', open });
	}, []);

	return {
		menus,
		fileMenuOpen: menus.file,
		editMenuOpen: menus.edit,
		viewMenuOpen: menus.view,
		windowMenuOpen: menus.window,
		terminalMenuOpen: menus.terminal,
		toggleMenubarMenu,
		setMenubarMenu,
		setTerminalMenuOpen,
	};
}
