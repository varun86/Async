import { useEffect, useState } from 'react';
import { ChatMarkdown } from './ChatMarkdown';
import type { ParsedPlan, PlanTodoItem } from './planParser';
import { useI18n } from './i18n';
import { VoidSelect } from './VoidSelect';
import type { ModelPickerItem } from './ModelPickerDropdown';

type Props = {
	plan: ParsedPlan;
	planFileDisplayPath: string | null;
	initialBuildModelId: string;
	modelItems: ModelPickerItem[];
	/** 当前会话已对该计划文件成功执行 Build */
	planBuilt?: boolean;
	buildDisabled?: boolean;
	onBuild: (modelId: string) => void;
	onClose: () => void;
	onTodoToggle: (id: string) => void;
};

function TodoCheckbox({ checked }: { checked: boolean }) {
	return (
		<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
			<rect
				x="1" y="1" width="14" height="14" rx="3"
				stroke={checked ? '#e8a848' : '#555'}
				strokeWidth="1.5"
				fill={checked ? '#e8a848' : 'none'}
			/>
			{checked ? (
				<path d="M4.5 8l2.5 2.5 4.5-5" stroke="#1a1a1a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
			) : null}
		</svg>
	);
}

function TodoItem({ todo, onToggle }: { todo: PlanTodoItem; onToggle: () => void }) {
	const done = todo.status === 'completed';
	return (
		<button type="button" className={`ref-plan-todo ${done ? 'is-done' : ''}`} onClick={onToggle}>
			<TodoCheckbox checked={done} />
			<span className="ref-plan-todo-text">{todo.content}</span>
		</button>
	);
}

export function PlanReviewPanel({
	plan,
	planFileDisplayPath,
	initialBuildModelId,
	modelItems,
	planBuilt = false,
	buildDisabled = false,
	onBuild,
	onClose,
	onTodoToggle,
}: Props) {
	const { t } = useI18n();
	const [showTodos, setShowTodos] = useState(true);
	const [showFullPlan, setShowFullPlan] = useState(false);
	const [buildModelId, setBuildModelId] = useState(initialBuildModelId);
	const doneCount = plan.todos.filter((t) => t.status === 'completed').length;

	useEffect(() => {
		setBuildModelId(initialBuildModelId);
	}, [initialBuildModelId, plan.name]);

	return (
		<div className="ref-plan-review" role="region" aria-label={t('plan.review.aria')}>
			<div className="ref-plan-review-head">
				<div className="ref-plan-review-head-left">
					<span className="ref-plan-review-label">{t('plan.review.label')}</span>
					<button
						type="button"
						className="ref-plan-review-close"
						aria-label={t('common.close')}
						onClick={onClose}
					>
						<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
							<path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
						</svg>
					</button>
				</div>
				<div className="ref-plan-review-head-model">
					<label className="ref-plan-review-model-label" htmlFor="ref-plan-build-model">
						{t('plan.review.model')}
					</label>
					<VoidSelect
						id="ref-plan-build-model"
						variant="compact"
						ariaLabel={t('plan.review.model')}
						value={buildModelId}
						disabled={planBuilt || modelItems.length === 0}
						onChange={setBuildModelId}
						options={[
							{ value: '', label: t('plan.review.pickModel'), disabled: true },
							...modelItems.map((m) => ({ value: m.id, label: m.label })),
						]}
					/>
				</div>
			</div>

			<div className="ref-plan-review-body">
				<div className="ref-plan-review-title">{plan.name}</div>
				{plan.overview ? (
					<p className="ref-plan-review-overview">{plan.overview}</p>
				) : null}

				{planFileDisplayPath ? (
					<div className="ref-plan-review-file">
						<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
							<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
							<polyline points="14 2 14 8 20 8" />
						</svg>
						<span className="ref-plan-review-file-path">{planFileDisplayPath}</span>
					</div>
				) : null}

				<div className="ref-plan-review-full-toggle">
					<button
						type="button"
						className="ref-plan-review-full-btn"
						aria-expanded={showFullPlan}
						onClick={() => setShowFullPlan((v) => !v)}
					>
						{showFullPlan ? t('plan.review.fullHide') : t('plan.review.fullShow')}
						<svg
							width="12"
							height="12"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
							className={`ref-plan-review-chev ${showFullPlan ? 'is-open' : ''}`}
							aria-hidden
						>
							<path d="M6 9l6 6 6-6" strokeLinecap="round" />
						</svg>
					</button>
					{showFullPlan ? (
						<div className="ref-plan-review-md">
							<ChatMarkdown content={plan.body} />
						</div>
					) : null}
				</div>

				{plan.todos.length > 0 ? (
					<div className="ref-plan-review-todos">
						<button
							type="button"
							className="ref-plan-review-todos-head"
							onClick={() => setShowTodos((v) => !v)}
						>
							<span>{t('plan.review.todo', { done: doneCount, total: plan.todos.length })}</span>
							<svg
								width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
								className={`ref-plan-review-chev ${showTodos ? 'is-open' : ''}`}
								aria-hidden
							>
								<path d="M6 9l6 6 6-6" strokeLinecap="round" />
							</svg>
						</button>
						{showTodos ? (
							<div className="ref-plan-review-todos-list">
								{plan.todos.map((item) => (
									<TodoItem key={item.id} todo={item} onToggle={() => onTodoToggle(item.id)} />
								))}
							</div>
						) : null}
					</div>
				) : null}
			</div>

			<div className="ref-plan-review-foot">
				{planBuilt ? (
					<div className="ref-plan-review-built" role="status">
						{t('app.planEditorBuilt')}
					</div>
				) : (
					<button
						type="button"
						className="ref-plan-review-build"
						disabled={buildDisabled || !buildModelId.trim() || modelItems.length === 0}
						onClick={() => onBuild(buildModelId)}
					>
						{t('plan.review.build')}
						<kbd className="ref-kbd">Ctrl+&#x21B5;</kbd>
					</button>
				)}
			</div>
		</div>
	);
}
