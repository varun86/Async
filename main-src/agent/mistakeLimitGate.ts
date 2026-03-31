/**
 * 连续工具失败后暂停 Agent，等待用户选择继续 / 补充说明 / 停止（对齐 Cline mistake_limit 交互）。
 */

export type MistakeLimitContext = {
	consecutiveFailures: number;
	threshold: number;
};

export type MistakeLimitDecision =
	| { action: 'continue' }
	| { action: 'stop'; message?: string }
	| { action: 'hint'; userText: string };

export type MistakeLimitSend = (obj: unknown) => void;

export function createMistakeLimitReachedHandler(
	send: MistakeLimitSend,
	threadId: string,
	signal: AbortSignal,
	waiters: Map<string, (d: MistakeLimitDecision) => void>
): (ctx: MistakeLimitContext) => Promise<MistakeLimitDecision> {
	let seq = 0;

	return async (ctx) => {
		const id = `ml-${threadId}-${Date.now()}-${++seq}`;
		return await new Promise<MistakeLimitDecision>((resolve) => {
			if (signal.aborted) {
				resolve({ action: 'stop', message: '已中止生成。' });
				return;
			}
			const onAbort = () => {
				waiters.delete(id);
				resolve({ action: 'stop', message: '已中止生成。' });
			};
			signal.addEventListener('abort', onAbort, { once: true });
			waiters.set(id, (d) => {
				signal.removeEventListener('abort', onAbort);
				waiters.delete(id);
				resolve(d);
			});
			send({
				threadId,
				type: 'agent_mistake_limit',
				recoveryId: id,
				consecutiveFailures: ctx.consecutiveFailures,
				threshold: ctx.threshold,
			});
		});
	};
}

export function resolveMistakeLimitRecovery(
	waiters: Map<string, (d: MistakeLimitDecision) => void>,
	recoveryId: string,
	decision: MistakeLimitDecision
): void {
	const fn = waiters.get(recoveryId);
	if (fn) {
		waiters.delete(recoveryId);
		fn(decision);
	}
}
