import { describe, expect, it } from 'vitest';
import { normalizePlanQuestionArgs } from './planQuestionTool.js';

describe('normalizePlanQuestionArgs', () => {
	it('keeps only 3 concrete options and appends custom option last', () => {
		const out = normalizePlanQuestionArgs({
			question: '你想重构项目的哪个方面？',
			options: [
				{ id: 'architecture', label: '架构重构' },
				{ id: 'code-quality', label: '代码质量' },
				{ id: 'dependency', label: '依赖优化' },
				{ id: 'performance', label: '性能优化' },
				{ id: 'custom', label: '其他（请填写）' },
			],
		});

		expect(out.ok).toBe(true);
		if (!out.ok) return;
		expect(out.q.options).toEqual([
			{ id: 'architecture', label: '架构重构' },
			{ id: 'code-quality', label: '代码质量' },
			{ id: 'dependency', label: '依赖优化' },
			{ id: 'custom', label: '其他（请填写）' },
		]);
	});

	it('synthesizes custom option when model forgets it', () => {
		const out = normalizePlanQuestionArgs({
			question: 'Which direction should I take?',
			options: ['Architecture', 'Code quality', 'Dependencies', 'Performance'],
		});

		expect(out.ok).toBe(true);
		if (!out.ok) return;
		expect(out.q.options).toEqual([
			{ id: 'choice_1', label: 'Architecture' },
			{ id: 'choice_2', label: 'Code quality' },
			{ id: 'choice_3', label: 'Dependencies' },
			{ id: 'custom', label: 'Other (please specify)' },
		]);
	});

	it('supports freeform-only fallback questions', () => {
		const out = normalizePlanQuestionArgs({
			question: '请补充你想优化的具体模块和目标。',
			freeform: true,
			options: [{ id: 'custom', label: '请补充说明' }],
		});

		expect(out.ok).toBe(true);
		if (!out.ok) return;
		expect(out.q.freeform).toBe(true);
		expect(out.q.options).toEqual([{ id: 'custom', label: '请补充说明' }]);
	});
});
