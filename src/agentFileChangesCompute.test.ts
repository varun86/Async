import { describe, expect, it } from 'vitest';
import { computeMergedAgentFileChanges } from './agentFileChangesCompute';
import type { TFunction } from './i18n';
import type { ChatMessage } from './threadTypes';

const t = ((key: string) => key) as unknown as TFunction;

function assistant(content: string): ChatMessage {
	return { role: 'assistant', content };
}

describe('computeMergedAgentFileChanges', () => {
	it('includes snapshot-only paths for agent mode', () => {
		const result = computeMergedAgentFileChanges(
			[assistant('')],
			'agent',
			t,
			new Set(),
			{ gitStatusOk: false, gitChangedPaths: [], diffPreviews: {} },
			null,
			new Set(['src/bash-edited.ts'])
		);
		expect(result).toEqual([
			{ path: 'src/bash-edited.ts', additions: 0, deletions: 0 },
		]);
	});

	it('includes snapshot-only paths for team mode', () => {
		const result = computeMergedAgentFileChanges(
			[assistant('')],
			'team',
			t,
			new Set(),
			{ gitStatusOk: false, gitChangedPaths: [], diffPreviews: {} },
			null,
			new Set(['src/team-worker.ts'])
		);
		expect(result).toEqual([
			{ path: 'src/team-worker.ts', additions: 0, deletions: 0 },
		]);
	});

	it('merges snapshot paths with git stats and respects dismissal', () => {
		const result = computeMergedAgentFileChanges(
			[assistant('')],
			'agent',
			t,
			new Set(['src/skip.ts']),
			{
				gitStatusOk: true,
				gitChangedPaths: ['src/bash-edited.ts', 'src/skip.ts'],
				diffPreviews: {
					'src/bash-edited.ts': { additions: 3, deletions: 1 },
					'src/skip.ts': { additions: 9, deletions: 4 },
				},
			},
			null,
			new Set(['src/bash-edited.ts', 'src/skip.ts'])
		);
		expect(result).toEqual([
			{ path: 'src/bash-edited.ts', additions: 3, deletions: 1 },
		]);
	});

	it('keeps snapshot-only paths visible even when git is already clean', () => {
		const result = computeMergedAgentFileChanges(
			[assistant('')],
			'agent',
			t,
			new Set(),
			{ gitStatusOk: true, gitChangedPaths: [], diffPreviews: {} },
			null,
			new Set(['src/clean-after-bash.ts'])
		);
		expect(result).toEqual([
			{ path: 'src/clean-after-bash.ts', additions: 0, deletions: 0 },
		]);
	});
});
