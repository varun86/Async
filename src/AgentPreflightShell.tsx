/**
 * 用户气泡正下方的「过程区」统一壳。
 *
 * 把 AI 在产出实际结果（file_edit / 命令围栏 / 收尾总结）之前的所有过程性内容
 * （思考 / 搜索 / 读取 / 解释性 markdown / Explored 分组）统一收纳到一个三态容器中：
 *
 * - `preview`（默认）：head 下方留 min-height 的滚动预览，正文可粘底跟随流式。
 * - `expanded`：用户主动展开后不限高，完全融入聊天流。
 * - `collapsed`：只剩 head 一行 summary。当本回合下方已出现真正的结果输出
 *   （`hasOutcome=true`）时自动切到该态，把注意力让给结果区；用户手动 toggle
 *   过则不再被覆盖。
 *
 * 同时 `liveTurn` 由 true→false 时（回合结束）若仍非 collapsed，延迟收成 collapsed。
 */
import {
	memo,
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
	type ReactNode,
} from 'react';
import { useI18n } from './i18n';
import type { TurnTokenUsage } from './ipcTypes';

type DisplayState = 'collapsed' | 'preview' | 'expanded';

type Props = {
	children: ReactNode;
	/** 本回合是否仍在进行（awaitingReply && isLast） */
	liveTurn?: boolean;
	/** 本回合下方是否已出现实际结果（file_edit / 命令围栏 / 收尾总结） */
	hasOutcome?: boolean;
	/** 思考阶段：用于 head 文案与 spinner */
	phase?: 'thinking' | 'streaming' | 'done';
	/** done 阶段可在末尾展示 token 用量 */
	tokenUsage?: TurnTokenUsage | null;
};

export const AgentPreflightShell = memo(function AgentPreflightShell({
	children,
	liveTurn = false,
	hasOutcome = false,
	phase = 'thinking',
	tokenUsage,
}: Props) {
	const { t } = useI18n();

	const [displayState, setDisplayState] = useState<DisplayState>(() =>
		hasOutcome ? 'collapsed' : 'preview'
	);
	const userToggledRef = useRef(false);
	const prevLiveTurnRef = useRef(liveTurn);

	useEffect(() => {
		if (!hasOutcome) return;
		if (userToggledRef.current) return;
		setDisplayState('collapsed');
	}, [hasOutcome]);

	useEffect(() => {
		const wasLive = prevLiveTurnRef.current;
		prevLiveTurnRef.current = liveTurn;
		if (wasLive && !liveTurn && !userToggledRef.current) {
			const id = setTimeout(() => setDisplayState('collapsed'), 600);
			return () => clearTimeout(id);
		}
	}, [liveTurn]);

	const bodyRef = useRef<HTMLDivElement>(null);
	const pinnedToBottomRef = useRef(true);

	const onBodyScroll = useCallback(() => {
		const el = bodyRef.current;
		if (!el) return;
		const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
		pinnedToBottomRef.current = distFromBottom < 40;
	}, []);

	useLayoutEffect(() => {
		if (displayState === 'collapsed' || !pinnedToBottomRef.current) return;
		const el = bodyRef.current;
		if (el) el.scrollTop = el.scrollHeight;
	}, [children, displayState]);

	useEffect(() => {
		if (displayState !== 'collapsed') {
			pinnedToBottomRef.current = true;
			const el = bodyRef.current;
			if (el) el.scrollTop = el.scrollHeight;
		}
	}, [displayState]);

	/** 二态切换：preview/collapsed → expanded → preview；点击锁定，自动逻辑不再覆盖 */
	const onToggle = useCallback(() => {
		userToggledRef.current = true;
		setDisplayState((s) => (s === 'expanded' ? 'preview' : 'expanded'));
	}, []);

	const isOpen = displayState !== 'collapsed';
	const isPending = liveTurn && phase !== 'done';
	const headLabel = isPending
		? t('agent.preflight.working')
		: hasOutcome
			? t('agent.preflight.summary.done')
			: t('agent.preflight.summary.idle');

	return (
		<div
			className={`ref-preflight-shell ${isPending ? 'is-pending' : 'is-done'}`}
			data-state={displayState}
		>
			<button
				type="button"
				className="ref-preflight-shell-header"
				aria-expanded={isOpen}
				onClick={onToggle}
			>
				<span className="ref-preflight-shell-icon" aria-hidden>
					{isPending ? <SpinnerIcon /> : <ProcessIcon />}
				</span>
				<span className="ref-preflight-shell-summary">{headLabel}</span>
				<span className="ref-preflight-shell-chevron" aria-hidden>
					<ChevronDown />
				</span>
			</button>

			<div className={`ref-preflight-shell-collapse ${isOpen ? 'is-open' : ''}`}>
				<div
					ref={bodyRef}
					className={`ref-preflight-shell-body ${isPending ? 'ref-preflight-shell-body--live' : ''}`}
					onScroll={onBodyScroll}
				>
					{children}
					{phase === 'done' && tokenUsage && (tokenUsage.inputTokens || tokenUsage.outputTokens) ? (
						<div className="ref-preflight-shell-usage">
							{t('usage.tokens', {
								input: (tokenUsage.inputTokens ?? 0).toLocaleString(),
								output: (tokenUsage.outputTokens ?? 0).toLocaleString(),
							})}
						</div>
					) : null}
				</div>
			</div>
		</div>
	);
});

function ProcessIcon() {
	return (
		<svg
			width="13"
			height="13"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden
		>
			<circle cx="11" cy="11" r="8" />
			<path d="M21 21l-4.35-4.35" />
		</svg>
	);
}

function SpinnerIcon() {
	return (
		<svg
			className="ref-preflight-shell-spinner"
			width="13"
			height="13"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2.5"
			strokeLinecap="round"
			aria-hidden
		>
			<path d="M12 2a10 10 0 0 1 10 10" />
		</svg>
	);
}

function ChevronDown() {
	return (
		<svg
			width="11"
			height="11"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2.5"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden
		>
			<path d="M6 9l6 6 6-6" />
		</svg>
	);
}
