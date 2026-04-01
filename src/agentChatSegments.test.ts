import { describe, expect, it } from 'vitest';
import { segmentAssistantContent } from './agentChatSegments';

describe('segmentAssistantContent', () => {
	it('parses streaming_code after tool protocol markers', () => {
		const content = [
			'<tool_call tool="read_file">{"path":"src/App.tsx"}</tool_call>',
			'<tool_result tool="read_file" success="true">  1|import React from \'react\';</tool_result>',
			'这里是正在输出的代码：',
			'```ts',
			'const answer = 42;',
		].join('\n');

		const segs = segmentAssistantContent(content);
		const streaming = segs.find((s) => s.type === 'streaming_code');

		expect(streaming).toBeDefined();
		if (streaming?.type === 'streaming_code') {
			expect(streaming.lang).toBe('ts');
			expect(streaming.body).toContain('const answer = 42;');
		}
	});

	it('shows streaming_code shell immediately when fence has no newline yet', () => {
		const content = [
			'<tool_call tool="list_dir">{"path":"src"}</tool_call>',
			'<tool_result tool="list_dir" success="true">[file] App.tsx</tool_result>',
			'```python',
		].join('\n');

		const segs = segmentAssistantContent(content);
		const streaming = segs.find((s) => s.type === 'streaming_code');

		expect(streaming).toBeDefined();
		if (streaming?.type === 'streaming_code') {
			expect(streaming.lang).toBe('python');
			expect(streaming.body).toBe('');
		}
	});
});
