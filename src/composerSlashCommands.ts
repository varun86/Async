import type { SlashCommandId } from './composerSegments';

export type BuiltinSlashCommand = {
	id: string;
	/** 不含前导 /，如 create-skill */
	name: string;
	descriptionKey: string;
	/** 选中后插入方式 */
	insert: { type: 'chip'; chip: SlashCommandId } | { type: 'text'; text: string };
};

/** 菜单行（已解析 description） */
export type SlashMenuRowItem = BuiltinSlashCommand & { label: string; description: string };

/** 内置斜杠命令（可后续从设置里的 Commands 合并） */
export const BUILTIN_SLASH_COMMANDS: BuiltinSlashCommand[] = [
	{
		id: 'create-skill',
		name: 'create-skill',
		descriptionKey: 'slashCmd.createSkillDesc',
		insert: { type: 'chip', chip: 'create-skill' },
	},
	{
		id: 'create-rule',
		name: 'create-rule',
		descriptionKey: 'slashCmd.createRuleDesc',
		insert: { type: 'text', text: '/create-rule ' },
	},
	{
		id: 'create-subagent',
		name: 'create-subagent',
		descriptionKey: 'slashCmd.createSubagentDesc',
		insert: { type: 'text', text: '/create-subagent ' },
	},
];

/**
 * 首段为 `/...` 且光标仍在「命令名」内（未到空格后的参数区）时返回查询词（不含 /）。
 * plainPrefix：caret 前由 DOM 采样的纯文本前缀，须与首段文本对齐。
 */
export function getLeadingSlashCommandQuery(
	firstSegmentText: string,
	plainPrefix: string
): string | null {
	if (!firstSegmentText.startsWith('/') || plainPrefix.length === 0 || !firstSegmentText.startsWith(plainPrefix)) {
		return null;
	}
	const cmdToken = firstSegmentText.match(/^\/(\S*)/);
	if (!cmdToken) {
		return null;
	}
	const cmdEnd = cmdToken[0]!.length;
	if (plainPrefix.length > cmdEnd) {
		return null;
	}
	const afterSlash = plainPrefix.slice(1);
	if (/\s/u.test(afterSlash)) {
		return null;
	}
	return afterSlash;
}

export function filterSlashCommands(commands: BuiltinSlashCommand[], query: string): BuiltinSlashCommand[] {
	const q = query.trim().toLowerCase();
	if (!q) {
		return [...commands];
	}
	return commands.filter((c) => {
		const n = c.name.toLowerCase();
		const hay = `${n} ${c.id}`.toLowerCase();
		return n.startsWith(q) || hay.includes(q);
	});
}

/** 与 Claude Code `findSlashCommandPositions` 类似：用于在纯文本里标出 /command 范围（高亮校验） */
export function findSlashCommandTokenRanges(text: string): Array<{ start: number; end: number }> {
	const out: Array<{ start: number; end: number }> = [];
	const re = /(^|[\s\n])(\/[a-zA-Z][a-zA-Z0-9:._-]*)/gu;
	let m: RegExpExecArray | null;
	while ((m = re.exec(text)) !== null) {
		const pre = m[1] ?? '';
		const tok = m[2] ?? '';
		const start = m.index + pre.length;
		out.push({ start, end: start + tok.length });
	}
	return out;
}

export function isKnownBuiltinSlashToken(token: string): boolean {
	const name = token.startsWith('/') ? token.slice(1) : token;
	return BUILTIN_SLASH_COMMANDS.some((c) => c.name === name);
}
