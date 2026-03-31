/** 与渲染端 `src/agentSettingsTypes.ts` 保持字段一致 */

export type AgentRuleScope = 'always' | 'glob' | 'manual';

export type AgentRule = {
	id: string;
	name: string;
	content: string;
	scope: AgentRuleScope;
	globPattern?: string;
	enabled: boolean;
};

export type AgentSkill = {
	id: string;
	name: string;
	description: string;
	slug: string;
	content: string;
	enabled?: boolean;
};

export type AgentSubagent = {
	id: string;
	name: string;
	description: string;
	instructions: string;
	enabled?: boolean;
};

export type AgentCommand = {
	id: string;
	name: string;
	slash: string;
	body: string;
};

export type AgentCustomization = {
	importThirdPartyConfigs?: boolean;
	rules?: AgentRule[];
	skills?: AgentSkill[];
	subagents?: AgentSubagent[];
	commands?: AgentCommand[];
	/**
	 * 是否在执行 `execute_command` 前弹出确认（默认 true）。
	 * 设为 false 时命令将直接执行（仍有工作区目录限制）。
	 */
	confirmShellCommands?: boolean;
	/**
	 * 是否在 `write_to_file` / `str_replace` 写入前暂停等待确认（默认 false，依赖事后撤销）。
	 */
	confirmWritesBeforeExecute?: boolean;
	/**
	 * 对常见只读/低风险命令跳过确认（默认 true），如 `git status`、`npm test`。
	 */
	skipSafeShellCommandsConfirm?: boolean;
	/**
	 * 连续多少次工具失败（含用户拒绝执行）后暂停并询问用户（默认 5）。
	 */
	maxConsecutiveMistakes?: number;
	/**
	 * 是否启用「连续失败暂停」交互（默认 true）。
	 */
	mistakeLimitEnabled?: boolean;
};
