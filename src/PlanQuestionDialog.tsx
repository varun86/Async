import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { PlanQuestion } from './planParser';
import { useI18n } from './i18n';

type Props = {
	question: PlanQuestion;
	onSubmit: (answer: string) => void;
	onSkip: () => void;
};

function renderBoldMarkdown(text: string): ReactNode {
	const parts = text.split(/(\*\*[^*]+\*\*)/g);
	return parts.map((part, i) => {
		if (part.startsWith('**') && part.endsWith('**')) {
			return <strong key={i}>{part.slice(2, -2)}</strong>;
		}
		return part;
	});
}

const OTHER_PATTERNS = /^other|^其他|^自定义|^custom/i;

export function PlanQuestionDialog({ question, onSubmit, onSkip }: Props) {
	const { t } = useI18n();
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [customText, setCustomText] = useState('');
	const customInputRef = useRef<HTMLInputElement>(null);

	const lastOption = question.options[question.options.length - 1];
	const isSingleCustomOption =
		question.options.length === 1 &&
		!!lastOption &&
		(OTHER_PATTERNS.test(lastOption.label.replace(/[.*…。]+$/, '')) ||
			OTHER_PATTERNS.test(String(lastOption.id ?? '').replace(/[.*…。]+$/, '')));
	const isFreeform = question.freeform || isSingleCustomOption;
	const isLastOther = useMemo(
		() => !!lastOption && OTHER_PATTERNS.test(lastOption.label.replace(/[.*…。]+$/, '')),
		[lastOption]
	);

	useEffect(() => {
		if (isFreeform) {
			setCustomText('');
			setSelectedId(lastOption?.id ?? 'custom');
			setTimeout(() => customInputRef.current?.focus(), 30);
			return;
		}
		setSelectedId(null);
		setCustomText('');
	}, [question.text, lastOption?.id, isFreeform]);

	const canContinue = isFreeform
		? customText.trim().length > 0
		: selectedId !== null &&
			(selectedId !== lastOption?.id || !isLastOther || customText.trim().length > 0);

	const handleSelect = useCallback(
		(id: string) => {
			setSelectedId(id);
			if (isLastOther && id === lastOption?.id) {
				setTimeout(() => customInputRef.current?.focus(), 30);
			}
		},
		[isLastOther, lastOption]
	);

	const handleContinue = () => {
		if (isFreeform) {
			onSubmit(customText.trim());
			return;
		}
		if (!selectedId) return;
		if (isLastOther && selectedId === lastOption?.id) {
			onSubmit(customText.trim());
		} else {
			const opt = question.options.find((o) => o.id === selectedId);
			onSubmit(opt ? `${opt.id}. ${opt.label}` : selectedId);
		}
	};

	return (
		<div className="ref-plan-q" role="dialog" aria-label={t('plan.q.aria')}>
			<div className="ref-plan-q-head">
				<span className="ref-plan-q-title">{t('plan.q.title')}</span>
			</div>
			<div className="ref-plan-q-body">
				<p className="ref-plan-q-text">{renderBoldMarkdown(question.text)}</p>
				{isFreeform ? (
					<div className="ref-plan-q-options">
						<div className="ref-plan-q-opt is-selected ref-plan-q-opt--freeform">
							<span className="ref-plan-q-opt-id">A</span>
							<span className="ref-plan-q-opt-label ref-plan-q-opt-label--other">
								<span className="ref-plan-q-opt-other-prefix">
									{renderBoldMarkdown(lastOption?.label ?? t('plan.q.customPh'))}
								</span>
								<input
									ref={customInputRef}
									type="text"
									className="ref-plan-q-custom-input"
									placeholder={t('plan.q.customPh')}
									value={customText}
									onChange={(e) => setCustomText(e.target.value)}
									onKeyDown={(e) => {
										if (e.key === 'Enter' && canContinue) {
											e.preventDefault();
											handleContinue();
										}
									}}
								/>
							</span>
						</div>
					</div>
				) : (
					<div className="ref-plan-q-options" role="radiogroup">
						{question.options.map((opt, idx) => {
							const isOtherSlot = isLastOther && idx === question.options.length - 1;
							const active = selectedId === opt.id;
							const displayId = String.fromCharCode(65 + idx); // A, B, C, …
							return (
								<button
									key={opt.id}
									type="button"
									role="radio"
									aria-checked={active}
									className={`ref-plan-q-opt ${active ? 'is-selected' : ''}`}
									onClick={() => handleSelect(opt.id)}
								>
									<span className="ref-plan-q-opt-id">{displayId}</span>
									{isOtherSlot ? (
										<span className="ref-plan-q-opt-label ref-plan-q-opt-label--other">
											<span className="ref-plan-q-opt-other-prefix">
												{renderBoldMarkdown(opt.label)}
											</span>
											{active ? (
												<input
													ref={customInputRef}
													type="text"
													className="ref-plan-q-custom-input"
													placeholder={t('plan.q.customPh')}
													value={customText}
													onClick={(e) => e.stopPropagation()}
													onChange={(e) => setCustomText(e.target.value)}
													onKeyDown={(e) => {
														if (e.key === 'Enter' && canContinue) {
															e.preventDefault();
															handleContinue();
														}
													}}
												/>
											) : null}
										</span>
									) : (
										<span className="ref-plan-q-opt-label">
											{renderBoldMarkdown(opt.label)}
										</span>
									)}
								</button>
							);
						})}
					</div>
				)}
			</div>
			<div className="ref-plan-q-foot">
				<button type="button" className="ref-plan-q-btn ref-plan-q-btn--ghost" onClick={onSkip}>
					{t('common.skip')}
				</button>
				<button
					type="button"
					className="ref-plan-q-btn ref-plan-q-btn--primary"
					disabled={!canContinue}
					onClick={handleContinue}
				>
					{t('common.continue')}
					<span className="ref-plan-q-btn-arrow">&#x2197;</span>
				</button>
			</div>
		</div>
	);
}
