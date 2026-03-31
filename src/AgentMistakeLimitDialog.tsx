import { useState } from 'react';
import { createPortal } from 'react-dom';

export type MistakeLimitPayload = {
	recoveryId: string;
	consecutiveFailures: number;
	threshold: number;
};

type Props = {
	open: boolean;
	payload: MistakeLimitPayload | null;
	onContinue: () => void;
	onStop: () => void;
	onSendHint: (hint: string) => void;
	title: string;
	body: string;
	continueLabel: string;
	stopLabel: string;
	hintFieldLabel: string;
	sendHintLabel: string;
	hintPlaceholder: string;
};

export function AgentMistakeLimitDialog({
	open,
	payload,
	onContinue,
	onStop,
	onSendHint,
	title,
	body,
	continueLabel,
	stopLabel,
	hintFieldLabel,
	sendHintLabel,
	hintPlaceholder,
}: Props) {
	const [hint, setHint] = useState('');

	if (!open || !payload) {
		return null;
	}

	return createPortal(
		<div
			className="ref-tool-approval-overlay"
			role="dialog"
			aria-modal="true"
			aria-labelledby="ref-mistake-limit-title"
		>
			<div className="ref-tool-approval-backdrop" onClick={onStop} aria-hidden />
			<div className="ref-tool-approval-card ref-mistake-limit-card">
				<h2 id="ref-mistake-limit-title" className="ref-tool-approval-title">
					{title}
				</h2>
				<p className="ref-mistake-limit-body">{body}</p>
				<label className="ref-mistake-limit-hint-label" htmlFor="ref-mistake-limit-ta">
					{hintFieldLabel}
				</label>
				<textarea
					id="ref-mistake-limit-ta"
					className="ref-mistake-limit-textarea"
					rows={3}
					value={hint}
					placeholder={hintPlaceholder}
					onChange={(e) => setHint(e.target.value)}
				/>
				<div className="ref-tool-approval-actions ref-mistake-limit-actions">
					<button type="button" className="ref-tool-approval-btn ref-tool-approval-btn--deny" onClick={onStop}>
						{stopLabel}
					</button>
					<button type="button" className="ref-tool-approval-btn ref-tool-approval-btn--allow" onClick={onContinue}>
						{continueLabel}
					</button>
					<button
						type="button"
						className="ref-tool-approval-btn ref-mistake-limit-btn-hint"
						disabled={!hint.trim()}
						onClick={() => {
							const t = hint.trim();
							if (!t) return;
							setHint('');
							onSendHint(t);
						}}
					>
						{sendHintLabel}
					</button>
				</div>
			</div>
		</div>,
		document.body
	);
}
