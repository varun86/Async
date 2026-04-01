import { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { AgentActivityGroup } from './AgentActivityGroup';
import { AgentCommandCard } from './AgentCommandCard';
import { AgentDiffCard } from './AgentDiffCard';
import { AgentStreamingFenceCard } from './AgentStreamingFenceCard';
import { AgentEditCard } from './AgentEditCard';
import { AgentResultCard } from './AgentResultCard';
import {
	buildStreamingToolSegments,
	segmentAssistantContentUnified,
	type AssistantSegment,
	type StreamingToolPreview,
} from './agentChatSegments';
import { useI18n } from './i18n';

/** 有 tool_input_delta 预览时，解析层也会生成 isStreaming 的 file_edit，避免与预览重复且保证预览优先显示 */
function dropParsedStreamingFileEditWhilePreview(
	segments: AssistantSegment[],
	hasPreview: boolean
): AssistantSegment[] {
	if (!hasPreview) return segments;
	return segments.filter((seg) => !(seg.type === 'file_edit' && seg.isStreaming));
}

type Props = {
	content: string;
	agentUi?: boolean;
	workspaceRoot?: string | null;
	onOpenAgentFile?: (relPath: string, revealLine?: number, revealEndLine?: number) => void;
	onRunCommand?: (cmd: string) => void;
	streamingToolPreview?: StreamingToolPreview | null;
	showAgentWorking?: boolean;
};

export function ChatMarkdown({
	content,
	agentUi = false,
	workspaceRoot,
	onOpenAgentFile,
	onRunCommand,
	streamingToolPreview,
	showAgentWorking = false,
}: Props) {
	const { t } = useI18n();

	/**
	 * 将 content 解析与 streamingToolPreview 拆开：
	 * content 解析涉及全量 tool 协议扫描，开销较大；
	 * streamingToolPreview 变化极频繁（每个 tool_input_delta 都触发），
	 * 拆分后 preview 变化只需做轻量合并，避免阻塞 React 渲染导致流式卡片被跳过。
	 */
	const parsedSegments = useMemo(() => {
		if (!agentUi) return [] as AssistantSegment[];
		const t0 = performance.now();
		const result = segmentAssistantContentUnified(content, { t });
		if (import.meta.env.DEV) {
			const elapsed = performance.now() - t0;
			if (elapsed > 8) {
				// eslint-disable-next-line no-console
				console.log(
					`[ChatMarkdown] parsedSegments: ${elapsed.toFixed(1)}ms, contentLen=${content.length}, segs=${result.length}`
				);
			}
		}
		return result;
	}, [agentUi, content, t]);

	const renderSegments = useMemo(() => {
		if (!agentUi) {
			return [] as AssistantSegment[];
		}
		const filtered = dropParsedStreamingFileEditWhilePreview(
			parsedSegments,
			streamingToolPreview != null
		);
		const streamingSegments = buildStreamingToolSegments(streamingToolPreview, { t });
		const segs: AssistantSegment[] = [...filtered, ...streamingSegments];
		const hasPendingTail =
			segs.some((s) => s.type === 'activity' && s.status === 'pending') ||
			streamingToolPreview != null;
		if (showAgentWorking && !hasPendingTail) {
			segs.push({
				type: 'activity',
				text: t('agent.working'),
				status: 'pending',
			});
		}
		return segs;
	}, [agentUi, parsedSegments, t, streamingToolPreview, showAgentWorking]);

	if (!agentUi) {
		return (
			<div className="ref-md-root">
				<ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
			</div>
		);
	}

	if (renderSegments.length === 0) {
		return <div className="ref-md-root ref-md-root--agent-chat" />;
	}
	if (renderSegments.length === 1 && renderSegments[0]!.type === 'markdown') {
		return (
			<div className="ref-md-root ref-md-root--agent-chat">
				<ReactMarkdown remarkPlugins={[remarkGfm]}>{renderSegments[0]!.text}</ReactMarkdown>
			</div>
		);
	}

	return (
		<div className="ref-md-root ref-md-root--agent-chat">
			{renderSegments.map((seg, i) => {
				switch (seg.type) {
					case 'markdown':
						return <ReactMarkdown key={i} remarkPlugins={[remarkGfm]}>{seg.text}</ReactMarkdown>;
					case 'diff':
						return (
							<AgentDiffCard
								key={i}
								diff={seg.diff}
								workspaceRoot={workspaceRoot}
								onOpenFile={onOpenAgentFile}
							/>
						);
					case 'command':
						return <AgentCommandCard key={i} lang={seg.lang} body={seg.body} onRun={onRunCommand ? () => onRunCommand(seg.body) : undefined} />;
					case 'streaming_code':
						return <AgentStreamingFenceCard key={i} lang={seg.lang} body={seg.body} />;
					case 'file_edit':
						return (
							<AgentEditCard
								key={i}
								edit={seg}
								onOpenFile={onOpenAgentFile}
							/>
						);
				case 'activity_group':
					return (
						<AgentActivityGroup
							key={i}
							group={seg}
							onOpenFile={onOpenAgentFile}
							liveTurn={showAgentWorking}
							animateLineReveal={showAgentWorking}
						/>
					);
					case 'file_changes':
						return null;
					case 'sub_agent_markdown': {
						const label =
							seg.variant === 'thinking' ? t('agent.subAgent.thinking') : t('agent.subAgent.output');
						return (
							<div
								key={i}
								className="ref-sub-agent-md"
								style={{ marginLeft: Math.min(12 + (seg.depth - 1) * 10, 40) }}
							>
								<div className="ref-sub-agent-md-label">{label}</div>
								<div className="ref-md-root ref-md-root--agent-chat ref-sub-agent-md-body">
									<ReactMarkdown remarkPlugins={[remarkGfm]}>{seg.text}</ReactMarkdown>
								</div>
							</div>
						);
					}
					case 'activity': {
						const readLink = seg.agentReadLink;
						const openHintRaw = t('agent.activity.readOpenEditor');
						const openHint =
							openHintRaw === 'agent.activity.readOpenEditor'
								? 'Open in editor and highlight this range'
								: openHintRaw;
						return (
							<div
								key={i}
								className={`ref-agent-activity ref-agent-activity--${seg.status}${seg.nestParent ? ' ref-agent-activity--nested' : ''}`}
								style={
									seg.nestParent
										? { marginLeft: Math.min(12 + ((seg.nestDepth ?? 1) - 1) * 10, 40) }
										: undefined
								}
							>
								<div className="ref-agent-activity-main">
									<span className="ref-agent-activity-dot" aria-hidden />
									{readLink && onOpenAgentFile ? (
										<button
											type="button"
											className="ref-agent-activity-ref-link"
											title={openHint}
											onClick={() =>
												onOpenAgentFile(
													readLink.path,
													readLink.startLine,
													readLink.endLine
												)
											}
										>
											{seg.text}
										</button>
									) : (
										<span className="ref-agent-activity-text">{seg.text}</span>
									)}
									{seg.summary ? (
										<span className="ref-agent-activity-summary">{seg.summary}</span>
									) : null}
								</div>
								{seg.detail ? (
									<pre className="ref-agent-activity-detail">{seg.detail}</pre>
								) : null}
								{seg.resultLines && seg.resultLines.length > 0 && seg.resultKind ? (
									<AgentResultCard
										lines={seg.resultLines}
										kind={seg.resultKind}
										readSourcePath={seg.agentReadLink?.path}
										onOpenFile={onOpenAgentFile}
										animateLineReveal={showAgentWorking}
									/>
								) : null}
							</div>
						);
					}
					case 'tool_call':
						return (
							<p key={i} className="ref-agent-activity">
								{t('agent.toolPending', { name: seg.name })}
							</p>
						);
					case 'plan_todo':
						return (
							<div key={i} className="ref-plan-review-todos">
								<div className="ref-plan-review-todos-head">
									<span>{t('plan.review.todo', { 
										done: seg.todos.filter(t => t.status === 'completed').length, 
										total: seg.todos.length 
									})}</span>
								</div>
								<div className="ref-plan-review-todos-list">
									{seg.todos.map((todo) => {
										const done = todo.status === 'completed';
										return (
											<div key={todo.id} className={`ref-plan-todo ${done ? 'is-done' : ''}`}>
												<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
													<rect
														x="1" y="1" width="14" height="14" rx="3"
														stroke={done ? '#e8a848' : '#555'}
														strokeWidth="1.5"
														fill={done ? '#e8a848' : 'none'}
													/>
													{done ? (
														<path d="M4.5 8l2.5 2.5 4.5-5" stroke="#1a1a1a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
													) : null}
												</svg>
												<span className="ref-plan-todo-text">{todo.content}</span>
											</div>
										);
									})}
								</div>
							</div>
						);
					default:
						return null;
				}
			})}
		</div>
	);
}
