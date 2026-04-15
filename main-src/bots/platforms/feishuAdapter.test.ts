import { describe, expect, it } from 'vitest';
import { buildFeishuReplyPayload, extractFeishuMessageEvent } from './feishuAdapter.js';

describe('buildFeishuReplyPayload', () => {
	it('uses path.message_id required by the SDK', () => {
		expect(buildFeishuReplyPayload('om_123', 'hello')).toEqual({
			path: { message_id: 'om_123' },
			data: {
				content: '{"text":"hello"}',
				msg_type: 'text',
			},
		});
	});
});

describe('extractFeishuMessageEvent', () => {
	it('reads top-level long connection payloads', () => {
		const result = extractFeishuMessageEvent({
			sender: {
				sender_id: {
					open_id: 'ou_123',
					user_id: 'u_123',
				},
				sender_type: 'user',
			},
			message: {
				message_id: 'om_123',
				chat_id: 'oc_123',
				chat_type: 'p2p',
				message_type: 'text',
				content: '{"text":"hello"}',
			},
		});

		expect(result?.sender?.sender_id?.open_id).toBe('ou_123');
		expect(result?.message?.message_id).toBe('om_123');
	});

	it('also supports nested webhook-style payloads', () => {
		const result = extractFeishuMessageEvent({
			event: {
				sender: {
					sender_id: {
						union_id: 'on_123',
					},
					sender_type: 'user',
				},
				message: {
					message_id: 'om_456',
					chat_id: 'oc_456',
					chat_type: 'group',
					message_type: 'text',
					content: '{"text":"hello"}',
				},
			},
		});

		expect(result?.sender?.sender_id?.union_id).toBe('on_123');
		expect(result?.message?.chat_id).toBe('oc_456');
	});

	it('returns null for invalid payloads', () => {
		expect(extractFeishuMessageEvent(null)).toBeNull();
		expect(extractFeishuMessageEvent('oops')).toBeNull();
	});
});
