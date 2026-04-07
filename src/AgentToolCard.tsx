import { memo, useState } from 'react';
import type { ToolCallSegment } from './agentChatSegments';
import { useI18n } from './i18n';

const TOOL_ICONS: Record<string, string> = {
	read_file: '📖',
	write_to_file: '📝',
	str_replace: '✏️',
	list_dir: '📁',
	search_files: '🔍',
	execute_command: '⚡',
	Agent: '🤖',
	delegate_task: '🤖',
	Task: '🤖',
};

function summarizeArgs(name: string, args: Record<string, unknown>): string {
	switch (name) {
		case 'read_file':
			return String(args.path ?? '');
		case 'write_to_file':
			return String(args.path ?? '');
		case 'str_replace':
			return String(args.path ?? '');
		case 'list_dir':
			return String(args.path ?? '') || '.';
		case 'search_files':
			return String(args.pattern ?? '');
		case 'execute_command':
			return String(args.command ?? '');
		case 'Agent':
		case 'delegate_task':
		case 'Task':
			return String(args.prompt ?? args.task ?? '').slice(0, 100);
		default:
			return JSON.stringify(args).slice(0, 80);
	}
}

type Props = {
	segment: ToolCallSegment;
};

export const AgentToolCard = memo(function AgentToolCard({ segment }: Props) {
	const { t } = useI18n();
	const [expanded, setExpanded] = useState(false);
	const icon = TOOL_ICONS[segment.name] ?? '🔧';
	const toolKey = `agent.tool.${segment.name}`;
	const translated = t(toolKey);
	const label = translated !== toolKey ? translated : segment.name;
	const summary = summarizeArgs(segment.name, segment.args);
	const hasResult = segment.result !== undefined;
	const isSuccess = segment.success !== false;

	return (
		<div className={`ref-tool-card ${hasResult ? (isSuccess ? 'ref-tool-card--ok' : 'ref-tool-card--err') : 'ref-tool-card--pending'}`}>
			<button
				type="button"
				className="ref-tool-card-header"
				onClick={() => setExpanded((e) => !e)}
				aria-expanded={expanded}
			>
				<span className="ref-tool-card-icon">{icon}</span>
				<span className="ref-tool-card-label">{label}</span>
				<span className="ref-tool-card-summary" title={summary}>{summary}</span>
				{hasResult && (
					<span className={`ref-tool-card-status ${isSuccess ? 'ref-tool-card-status--ok' : 'ref-tool-card-status--err'}`}>
						{isSuccess ? '✓' : '✗'}
					</span>
				)}
				{!hasResult && <span className="ref-tool-card-spinner" />}
				<svg
					className={`ref-tool-card-chevron ${expanded ? 'ref-tool-card-chevron--open' : ''}`}
					width="14" height="14" viewBox="0 0 24 24"
					fill="none" stroke="currentColor" strokeWidth="2"
					strokeLinecap="round" strokeLinejoin="round"
				>
					<path d="M6 9l6 6 6-6" />
				</svg>
			</button>
			{expanded && (
				<div className="ref-tool-card-body">
					<div className="ref-tool-card-section">
						<div className="ref-tool-card-section-title">{t('agent.toolCard.args')}</div>
						<pre className="ref-tool-card-pre">{formatArgs(segment.name, segment.args)}</pre>
					</div>
					{hasResult && (
						<div className="ref-tool-card-section">
							<div className="ref-tool-card-section-title">{t('agent.toolCard.result')}</div>
							<pre className="ref-tool-card-pre">{segment.result}</pre>
						</div>
					)}
				</div>
			)}
		</div>
	);
});

function formatArgs(name: string, args: Record<string, unknown>): string {
	if (name === 'str_replace') {
		const lines: string[] = [];
		lines.push(`path: ${args.path}`);
		lines.push(`old_str:\n${args.old_str}`);
		lines.push(`new_str:\n${args.new_str}`);
		return lines.join('\n');
	}
	if (name === 'write_to_file') {
		const content = String(args.content ?? '');
		const preview = content.length > 500 ? content.slice(0, 500) + '\n...' : content;
		return `path: ${args.path}\ncontent:\n${preview}`;
	}
	return JSON.stringify(args, null, 2);
}
