import { describe, expect, it } from 'vitest';
import { buildAutoReplyLanguageRuleBlock, createAutoReplyLanguageRule } from '../../src/autoReplyLanguageRule.js';

describe('autoReplyLanguageRule', () => {
	it('builds readable Simplified Chinese instructions for zh-CN', () => {
		const rule = createAutoReplyLanguageRule('zh-CN', 'zh-CN');
		expect(rule.name).toBe('自动语言：默认使用简体中文回复');
		expect(rule.content).toBe('默认始终使用简体中文回复。只有当用户明确要求使用其他语言时，才切换到该语言。');

		const block = buildAutoReplyLanguageRuleBlock('zh-CN', 'zh-CN');
		expect(block).toContain('#### Rule: 自动语言：默认使用简体中文回复');
		expect(block).toContain('默认始终使用简体中文回复。只有当用户明确要求使用其他语言时，才切换到该语言。');
	});
});
