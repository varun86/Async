import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const requestJsonMock = vi.hoisted(() => vi.fn());

vi.mock('./common.js', async (importOriginal) => {
	const actual = await importOriginal<typeof import('./common.js')>();
	return { ...actual, requestJson: requestJsonMock };
});

import { FeishuCardKitClient, FeishuStreamingSession, type CardKitSchema } from './feishuCardKit.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function tokenResponse(token = 'tok_test', expire = 7200) {
	return { code: 0, msg: 'ok', tenant_access_token: token, expire };
}

function okResponse(data: Record<string, unknown> = {}) {
	return { code: 0, msg: 'ok', data };
}

function errorResponse(code: number, msg: string) {
	return { code, msg };
}

function createDeferred<T>() {
	let resolve!: (value: T | PromiseLike<T>) => void;
	let reject!: (reason?: unknown) => void;
	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
}

function createClient() {
	return new FeishuCardKitClient({
		appId: 'app_test',
		appSecret: 'secret_test',
		apiBase: 'https://api.test',
	});
}

/** Set up requestJsonMock to auto-respond to token + one follow-up call */
function mockTokenThenApi(apiResult: unknown) {
	requestJsonMock
		.mockResolvedValueOnce(tokenResponse())
		.mockResolvedValueOnce(apiResult);
}

// ---------------------------------------------------------------------------
// FeishuCardKitClient
// ---------------------------------------------------------------------------

describe('FeishuCardKitClient', () => {
	beforeEach(() => {
		requestJsonMock.mockReset();
	});

	describe('createCard', () => {
		it('sends card JSON and returns card_id', async () => {
			mockTokenThenApi(okResponse({ card_id: 'card_abc' }));
			const client = createClient();
			const cardId = await client.createCard({
				schema: '2.0',
				config: {
					streaming_mode: true,
					summary: { content: 'test' },
				},
				body: { elements: [{ tag: 'markdown', content: 'hi', element_id: 'content' }] },
			});
			expect(cardId).toBe('card_abc');

			// Verify token request
			expect(requestJsonMock).toHaveBeenCalledTimes(2);
			const tokenCall = requestJsonMock.mock.calls[0];
			expect(tokenCall[0]).toBe('https://api.test/auth/v3/tenant_access_token/internal');
			expect(tokenCall[1].body).toEqual({ app_id: 'app_test', app_secret: 'secret_test' });

			// Verify card creation request
			const cardCall = requestJsonMock.mock.calls[1];
			expect(cardCall[0]).toBe('https://api.test/cardkit/v1/cards');
			expect(cardCall[1].method).toBe('POST');
			expect(cardCall[1].headers.Authorization).toBe('Bearer tok_test');
			const body = cardCall[1].body as Record<string, unknown>;
			expect(body.type).toBe('card_json');
			expect(typeof body.data).toBe('string');
		});

		it('throws when response has no card_id', async () => {
			mockTokenThenApi(okResponse({}));
			const client = createClient();
			await expect(client.createCard({
				schema: '2.0',
				config: { streaming_mode: true, summary: { content: '' } },
				body: { elements: [] },
			} as CardKitSchema)).rejects.toThrow('missing card_id');
		});

		it('throws on API error', async () => {
			requestJsonMock
				.mockResolvedValueOnce(tokenResponse())
				.mockResolvedValueOnce(errorResponse(40003, 'permission denied'));
			const client = createClient();
			await expect(client.createCard({
				schema: '2.0',
				config: { streaming_mode: true, summary: { content: '' } },
				body: { elements: [] },
			} as CardKitSchema)).rejects.toThrow('permission denied');
		});
	});

	describe('updateElementContent', () => {
		it('sends PUT with correct path and body', async () => {
			mockTokenThenApi(okResponse());
			const client = createClient();
			await client.updateElementContent('card_1', 'el_1', 'new text', 3);

			const apiCall = requestJsonMock.mock.calls[1];
			expect(apiCall[0]).toBe('https://api.test/cardkit/v1/cards/card_1/elements/el_1/content');
			expect(apiCall[1].method).toBe('PUT');
			expect(apiCall[1].body).toEqual({
				content: 'new text',
				sequence: 3,
				uuid: 's_card_1_3',
			});
		});
	});

	describe('closeStreaming', () => {
		it('sends PATCH with settings payload', async () => {
			mockTokenThenApi(okResponse());
			const client = createClient();
			await client.closeStreaming('card_1', 'Done', 5);

			const apiCall = requestJsonMock.mock.calls[1];
			expect(apiCall[0]).toBe('https://api.test/cardkit/v1/cards/card_1/settings');
			expect(apiCall[1].method).toBe('PATCH');
			const body = apiCall[1].body as Record<string, unknown>;
			expect(body.sequence).toBe(5);
			expect(body.uuid).toBe('c_card_1_5');
			const settings = JSON.parse(body.settings as string);
			expect(settings.config.streaming_mode).toBe(false);
			expect(settings.config.summary.content).toBe('Done');
		});
	});

	describe('sendCardMessage', () => {
		it('sends to chat when no replyMessageId', async () => {
			mockTokenThenApi(okResponse({ message_id: 'msg_123' }));
			const client = createClient();
			const msgId = await client.sendCardMessage('chat_1', 'card_1');
			expect(msgId).toBe('msg_123');

			const apiCall = requestJsonMock.mock.calls[1];
			expect(apiCall[0]).toBe('https://api.test/im/v1/messages?receive_id_type=chat_id');
			expect(apiCall[1].body).toMatchObject({
				receive_id: 'chat_1',
				msg_type: 'interactive',
			});
		});

		it('replies to message when replyMessageId provided', async () => {
			mockTokenThenApi(okResponse({ message_id: 'msg_456' }));
			const client = createClient();
			const msgId = await client.sendCardMessage('chat_1', 'card_1', 'msg_orig');
			expect(msgId).toBe('msg_456');

			const apiCall = requestJsonMock.mock.calls[1];
			expect(apiCall[0]).toBe('https://api.test/im/v1/messages/msg_orig/reply');
		});

		it('throws when response has no message_id', async () => {
			mockTokenThenApi(okResponse({}));
			const client = createClient();
			await expect(client.sendCardMessage('chat_1', 'card_1')).rejects.toThrow('missing message_id');
		});
	});

	describe('token management', () => {
		it('reuses cached token within TTL', async () => {
			requestJsonMock
				.mockResolvedValueOnce(tokenResponse('tok_1'))
				.mockResolvedValueOnce(okResponse({ card_id: 'c1' }))
				.mockResolvedValueOnce(okResponse({ card_id: 'c2' }));

			const client = createClient();
			const card = { schema: '2.0', config: { streaming_mode: true, summary: { content: '' } }, body: { elements: [] } } as CardKitSchema;
			await client.createCard(card);
			await client.createCard(card);

			// Only one token request, two API calls
			expect(requestJsonMock).toHaveBeenCalledTimes(3);
			const urls = requestJsonMock.mock.calls.map((c: unknown[]) => c[0]);
			expect(urls.filter((u: string) => u.includes('tenant_access_token'))).toHaveLength(1);
		});

		it('retries once on token-expired error (99991663)', async () => {
			requestJsonMock
				.mockResolvedValueOnce(tokenResponse('tok_old'))  // first token
				.mockResolvedValueOnce(errorResponse(99991663, 'token expired'))  // API rejects
				.mockResolvedValueOnce(tokenResponse('tok_new'))  // refresh token
				.mockResolvedValueOnce(okResponse({ card_id: 'c_retry' }));  // retry succeeds

			const client = createClient();
			const card = { schema: '2.0', config: { streaming_mode: true, summary: { content: '' } }, body: { elements: [] } } as CardKitSchema;
			const cardId = await client.createCard(card);
			expect(cardId).toBe('c_retry');
			expect(requestJsonMock).toHaveBeenCalledTimes(4);
		});

		it('throws on token refresh failure', async () => {
			requestJsonMock.mockResolvedValueOnce(errorResponse(10001, 'invalid credentials'));
			const client = createClient();
			const card = { schema: '2.0', config: { streaming_mode: true, summary: { content: '' } }, body: { elements: [] } } as CardKitSchema;
			await expect(client.createCard(card)).rejects.toThrow('invalid credentials');
		});
	});
});

// ---------------------------------------------------------------------------
// FeishuStreamingSession
// ---------------------------------------------------------------------------

describe('FeishuStreamingSession', () => {
	let client: FeishuCardKitClient;

	beforeEach(() => {
		requestJsonMock.mockReset();
		vi.useFakeTimers();
		// Default: token + createCard + sendCardMessage
		requestJsonMock
			.mockResolvedValueOnce(tokenResponse())
			.mockResolvedValueOnce(okResponse({ card_id: 'card_stream' }))
			.mockResolvedValueOnce(okResponse({ message_id: 'msg_stream' }));
		client = createClient();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('starts a streaming session: creates card and sends message', async () => {
		const session = new FeishuStreamingSession(client);
		expect(session.isActive).toBe(false);
		expect(session.isFailed).toBe(false);

		await session.start('chat_1', 'msg_reply');
		expect(session.isActive).toBe(true);
		expect(session.isFailed).toBe(false);

		// token + createCard + sendMessage = 3 calls
		expect(requestJsonMock).toHaveBeenCalledTimes(3);
	});

	it('marks session as failed if start throws', async () => {
		requestJsonMock.mockReset();
		requestJsonMock.mockRejectedValueOnce(new Error('network down'));
		const failClient = createClient();
		const session = new FeishuStreamingSession(failClient);
		await session.start('chat_1');
		expect(session.isFailed).toBe(true);
		expect(session.isActive).toBe(false);
	});

	it('waits for startup to finish before sending the final close update', async () => {
		requestJsonMock.mockReset();
		const token = createDeferred<{ code: number; msg: string; tenant_access_token: string; expire: number }>();
		const createCard = createDeferred<{ code: number; msg: string; data: { card_id: string } }>();
		const sendMessage = createDeferred<{ code: number; msg: string; data: { message_id: string } }>();
		const updateContent = createDeferred<{ code: number; msg: string; data: Record<string, unknown> }>();
		const closeStreaming = createDeferred<{ code: number; msg: string; data: Record<string, unknown> }>();
		requestJsonMock
			.mockReturnValueOnce(token.promise)
			.mockReturnValueOnce(createCard.promise)
			.mockReturnValueOnce(sendMessage.promise)
			.mockReturnValueOnce(updateContent.promise)
			.mockReturnValueOnce(closeStreaming.promise);

		const raceClient = createClient();
		const session = new FeishuStreamingSession(raceClient);
		const startPromise = session.start('chat_1', 'msg_reply');
		session.update('intermediate text');
		const closePromise = session.close('Final answer.');

		expect(requestJsonMock).toHaveBeenCalledTimes(1);

		token.resolve(tokenResponse());
		createCard.resolve(okResponse({ card_id: 'card_race' }));
		sendMessage.resolve(okResponse({ message_id: 'msg_race' }));
		updateContent.resolve(okResponse());
		closeStreaming.resolve(okResponse());
		await startPromise;
		await closePromise;
		expect(requestJsonMock).toHaveBeenCalledTimes(5);

		const updateCall = requestJsonMock.mock.calls[3];
		expect(updateCall[0]).toContain('/cardkit/v1/cards/card_race/elements/content/content');
		expect(updateCall[1].body.content).toBe('Final answer.');

		const closeCall = requestJsonMock.mock.calls[4];
		expect(closeCall[0]).toContain('/cardkit/v1/cards/card_race/settings');
		expect(session.isActive).toBe(false);
	});

	it('update() is throttled and sends content after THROTTLE_MS', async () => {
		const session = new FeishuStreamingSession(client);
		await session.start('chat_1');
		requestJsonMock.mockResolvedValue(okResponse());

		session.update('Hello');
		session.update('Hello world');
		session.update('Hello world!');

		// Nothing sent yet (throttle timer not fired)
		expect(requestJsonMock).toHaveBeenCalledTimes(3); // only token + card + msg

		// Advance past throttle
		await vi.advanceTimersByTimeAsync(150);

		// One update call should have been made with latest content
		expect(requestJsonMock.mock.calls.length).toBeGreaterThan(3);
		const lastApiCall = requestJsonMock.mock.calls[requestJsonMock.mock.calls.length - 1];
		expect(lastApiCall[0]).toContain('/elements/content/content');
		expect(lastApiCall[1].body.content).toBe('Hello world!');
	});

	it('update() does nothing when session is not active', async () => {
		const session = new FeishuStreamingSession(client);
		// Not started — update should be a no-op
		const callsBefore = requestJsonMock.mock.calls.length;
		session.update('test');
		await vi.advanceTimersByTimeAsync(200);
		// No new API calls were made
		expect(requestJsonMock.mock.calls.length).toBe(callsBefore);
	});

	it('setToolStatus adds tool status block to content', async () => {
		const session = new FeishuStreamingSession(client);
		await session.start('chat_1');
		requestJsonMock.mockResolvedValue(okResponse());

		session.update('Working...');
		session.setToolStatus('Read', 'running');

		await vi.advanceTimersByTimeAsync(150);

		const updateCalls = requestJsonMock.mock.calls.slice(3);
		expect(updateCalls.length).toBeGreaterThan(0);
		const sentContent = updateCalls[updateCalls.length - 1][1].body.content as string;
		expect(sentContent).toContain('Working...');
		expect(sentContent).toContain('---');
		expect(sentContent).toContain('`Read`');
	});

	it('setToolStatus updates existing tool state', async () => {
		const session = new FeishuStreamingSession(client);
		await session.start('chat_1');
		requestJsonMock.mockResolvedValue(okResponse());

		session.setToolStatus('Bash', 'running');
		await vi.advanceTimersByTimeAsync(150);

		session.setToolStatus('Bash', 'completed');
		await vi.advanceTimersByTimeAsync(150);

		const updateCalls = requestJsonMock.mock.calls.slice(3);
		const lastContent = updateCalls[updateCalls.length - 1][1].body.content as string;
		expect(lastContent).toContain('✅');
		expect(lastContent).not.toContain('🔄');
	});

	it('close() sends final update and closes streaming', async () => {
		const session = new FeishuStreamingSession(client);
		await session.start('chat_1');
		requestJsonMock.mockResolvedValue(okResponse());

		await session.close('Final answer.');

		// After close: updateElement + closeStreaming = 2 more calls
		const closeCalls = requestJsonMock.mock.calls.slice(3);
		expect(closeCalls.length).toBe(2);

		// First: update element with final content
		expect(closeCalls[0][0]).toContain('/elements/content/content');
		expect(closeCalls[0][1].body.content).toBe('Final answer.');

		// Second: close streaming
		expect(closeCalls[1][0]).toContain('/settings');
		expect(closeCalls[1][1].method).toBe('PATCH');
		const settings = JSON.parse(closeCalls[1][1].body.settings);
		expect(settings.config.streaming_mode).toBe(false);
	});

	it('close() skips update if content unchanged', async () => {
		const session = new FeishuStreamingSession(client);
		await session.start('chat_1');
		requestJsonMock.mockResolvedValue(okResponse());

		// Update with some text, let throttle fire
		session.update('Same text');
		await vi.advanceTimersByTimeAsync(150);

		const callsBeforeClose = requestJsonMock.mock.calls.length;

		// Close with same text
		await session.close('Same text');

		const closeCalls = requestJsonMock.mock.calls.slice(callsBeforeClose);
		// Only closeStreaming (no redundant update since content is the same)
		expect(closeCalls.length).toBe(1);
		expect(closeCalls[0][0]).toContain('/settings');
	});

	it('close() is idempotent', async () => {
		const session = new FeishuStreamingSession(client);
		await session.start('chat_1');
		requestJsonMock.mockResolvedValue(okResponse());

		await session.close('Done');
		const callCount = requestJsonMock.mock.calls.length;

		await session.close('Done again');
		expect(requestJsonMock.mock.calls.length).toBe(callCount); // no additional calls
	});

	it('close() cancels pending throttle timer', async () => {
		const session = new FeishuStreamingSession(client);
		await session.start('chat_1');
		requestJsonMock.mockResolvedValue(okResponse());

		session.update('Pending...');
		// Do not advance timer — close immediately
		await session.close('Final.');

		const closeCalls = requestJsonMock.mock.calls.slice(3);
		// Should have: updateElement (with 'Final.') + closeStreaming
		expect(closeCalls.length).toBe(2);
		expect(closeCalls[0][1].body.content).toBe('Final.');

		// Advance timer to verify no late update fires
		const countAfterClose = requestJsonMock.mock.calls.length;
		await vi.advanceTimersByTimeAsync(200);
		expect(requestJsonMock.mock.calls.length).toBe(countAfterClose);
	});

	it('sequence numbers increment monotonically', async () => {
		const session = new FeishuStreamingSession(client);
		await session.start('chat_1');
		requestJsonMock.mockResolvedValue(okResponse());

		session.update('Step 1');
		await vi.advanceTimersByTimeAsync(150);
		session.update('Step 2');
		await vi.advanceTimersByTimeAsync(150);
		await session.close('Done');

		const apiCalls = requestJsonMock.mock.calls.slice(3);
		const sequences = apiCalls.map((c: unknown[]) => (c[1] as { body: { sequence: number } }).body.sequence);
		for (let i = 1; i < sequences.length; i++) {
			expect(sequences[i]).toBeGreaterThan(sequences[i - 1]);
		}
	});

	it('truncates content exceeding MAX_ELEMENT_SIZE', async () => {
		const session = new FeishuStreamingSession(client);
		await session.start('chat_1');
		requestJsonMock.mockResolvedValue(okResponse());

		const longText = 'a'.repeat(30_000);
		await session.close(longText);

		const updateCall = requestJsonMock.mock.calls[3];
		const sentContent = updateCall[1].body.content as string;
		expect(sentContent.length).toBeLessThan(longText.length);
		expect(sentContent).toContain('...(内容过长，已截断)');
	});

	it('builds summary from short text', async () => {
		const session = new FeishuStreamingSession(client);
		await session.start('chat_1');
		requestJsonMock.mockResolvedValue(okResponse());

		await session.close('Short reply');
		const settingsCall = requestJsonMock.mock.calls[requestJsonMock.mock.calls.length - 1];
		const settings = JSON.parse(settingsCall[1].body.settings);
		expect(settings.config.summary.content).toBe('Short reply');
	});

	it('truncates summary for long text', async () => {
		const session = new FeishuStreamingSession(client);
		await session.start('chat_1');
		requestJsonMock.mockResolvedValue(okResponse());

		const longText = 'x'.repeat(200);
		await session.close(longText);
		const settingsCall = requestJsonMock.mock.calls[requestJsonMock.mock.calls.length - 1];
		const settings = JSON.parse(settingsCall[1].body.settings);
		expect(settings.config.summary.content.length).toBeLessThanOrEqual(83); // 80 + '...'
		expect(settings.config.summary.content).toContain('...');
	});
});
