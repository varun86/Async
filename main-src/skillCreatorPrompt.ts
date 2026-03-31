/** Skill 创建向导：注入系统提示（用户侧仅见简短气泡 + 自填说明） */

export type SkillCreatorScope = 'user' | 'project';

export function formatSkillCreatorUserBubble(
	scope: SkillCreatorScope,
	lang: 'zh-CN' | 'en',
	userNote: string
): string {
	const head =
		scope === 'project'
			? lang === 'en'
				? '[Create Skill · This project]'
				: '[创建 Skill · 本项目]'
			: lang === 'en'
				? '[Create Skill · All projects]'
				: '[创建 Skill · 所有项目]';
	const b = userNote.trim();
	return b ? `${head}\n${b}` : head;
}

export function buildSkillCreatorSystemAppend(
	scope: SkillCreatorScope,
	lang: 'zh-CN' | 'en',
	workspaceRoot: string | null
): string {
	const scopeBlock =
		scope === 'project'
			? lang === 'en'
				? `**Target scope: this project only.** The user chose to store the new skill for the current workspace. Prefer creating or updating files under \`.async/skills/<slug>/SKILL.md\` (and mention \`.async/agent.json\` only if they also need an in-app skill entry). If no workspace is open, you should not claim files were written. Workspace root (if any): \`${workspaceRoot ?? '(none)'}\`.`
				: `**适用范围：仅当前工作区。** 用户选择把新 Skill 存到当前项目。优先在工作区创建或更新 \`.async/skills/<slug>/SKILL.md\`（若还需出现在 Async 设置里，再说明是否同步写入 \`.async/agent.json\` 的 skills 列表）。若当前没有打开文件夹，不要假装已写入磁盘。工作区根目录：\`${workspaceRoot ?? '（无）'}\`。`
			: lang === 'en'
				? '**Target scope: all projects (global / user-level).** The user chose a skill that should apply across repositories. Describe saving via Async **Settings → Rules / Skills** (user-level skills list), not only a single repo path. Optionally mention \`~/.claude/skills/\` if they also use Claude Code-style layout on disk.'
				: '**适用范围：所有项目（全局 / 用户级）。** 用户选择跨仓库生效的 Skill。请说明如何通过 Async **设置 → Rules / Skills** 写入用户级 Skills 列表，而不是只写某个仓库路径。若用户也使用 Claude Code 式目录，可补充 \`~/.claude/skills/\` 作为可选落盘位置。';

	const core =
		lang === 'en'
			? `You are the **Skill Creator** for the Async app. The user's free-text request appears in their message (after the scope tag).

Your job:
1. Briefly confirm you understood their goal, then ask any **clarifying questions** needed (name, trigger situations, steps, output format).
2. When ready, output a complete **SKILL.md**-style document with YAML frontmatter at minimum \`name\` and \`description\`; add other frontmatter fields if useful (e.g. allowed-tools style hints as plain text guidance for Async).
3. Explain how to **invoke** the skill in Async (e.g. \`./slug\` in the composer when configured, plus disk path if applicable).
4. Keep answers actionable; prefer Markdown with clear headings.

${scopeBlock}`
			: `你是 Async 应用的 **Skill 创建向导**。用户的自由说明在其消息中（在范围标签之后）。

请完成：
1. 简短确认理解，再**追问**必要信息（名称、触发场景、步骤、输出格式等）。
2. 信息足够后，输出完整的 **SKILL.md** 风格文档，YAML frontmatter 至少包含 \`name\`、\`description\`；如有需要可补充其它 frontmatter（权限类提示可用文字说明，Async 会按自身模型解析）。
3. 说明在 Async 中**如何触发**该 Skill（例如在输入框使用 \`./slug\`，以及磁盘路径若适用）。
4. 回答要可执行，使用清晰的 Markdown 标题与列表。

${scopeBlock}`;

	return `### Async · Skill Creator（内置）\n\n${core}`;
}
