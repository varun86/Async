import { describe, expect, it } from 'vitest';
import { extractTeamLeadNarrative } from './teamWorkflowText';

describe('extractTeamLeadNarrative', () => {
	it('removes fenced task payloads and keeps the narrative text', () => {
		const input = `我先安排团队分析。

\`\`\`json
[
  { "expert": "frontend", "task": "Audit UI" }
]
\`\`\``;

		expect(extractTeamLeadNarrative(input)).toBe('我先安排团队分析。');
	});

	it('removes trailing raw JSON blocks after the narrative text', () => {
		const input = `我先分配前端同学查看渲染链路。
[
  { "expert": "frontend", "task": "Audit UI" }
]`;

		expect(extractTeamLeadNarrative(input)).toBe('我先分配前端同学查看渲染链路。');
	});
});
