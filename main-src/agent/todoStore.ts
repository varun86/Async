/**
 * TodoWrite 内存状态管理 — 按 key（通常为 threadId）管理 TODO 列表。
 */

export type TodoItem = {
	content: string;
	status: 'pending' | 'in_progress' | 'completed';
	activeForm: string;
};

const todosByKey = new Map<string, TodoItem[]>();

export function getTodos(key: string): TodoItem[] {
	return todosByKey.get(key) ?? [];
}

export function setTodos(key: string, todos: TodoItem[]): { oldTodos: TodoItem[]; newTodos: TodoItem[] } {
	const oldTodos = todosByKey.get(key) ?? [];
	const newTodos = todos;
	if (newTodos.length === 0) {
		todosByKey.delete(key);
	} else {
		todosByKey.set(key, newTodos);
	}
	return { oldTodos, newTodos };
}

export function clearTodos(key: string): void {
	todosByKey.delete(key);
}

export function getActiveTodo(key: string): TodoItem | null {
	const list = todosByKey.get(key);
	if (!list) return null;
	return list.find((t) => t.status === 'in_progress') ?? null;
}
