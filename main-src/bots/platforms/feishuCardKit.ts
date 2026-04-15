/**
 * Feishu CardKit v1 流式卡片客户端。
 *
 * API 概览（schema 2.0）：
 * 1. POST /cardkit/v1/cards          — 创建卡片实体 → card_id
 * 2. PUT  /cardkit/v1/cards/:card_id/elements/:element_id/content — 流式更新文本
 * 3. PATCH /cardkit/v1/cards/:card_id/settings — 关闭流式模式
 *
 * 权限：cardkit:card:write
 */

import { requestJson } from './common.js';
import type { BotTodoListItem } from './common.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CardKitSchema = {
	schema: '2.0';
	config: {
		streaming_mode: boolean;
		summary: { content: string };
		streaming_config?: {
			print_frequency_ms: { default: number };
			print_step: { default: number };
		};
	};
	body: {
		elements: Array<{ tag: string; content: string; element_id: string }>;
	};
};

type ApiResponse = {
	code: number;
	msg: string;
	data?: Record<string, unknown>;
};

// ---------------------------------------------------------------------------
// CardKit REST Client
// ---------------------------------------------------------------------------

export class FeishuCardKitClient {
	private readonly appId: string;
	private readonly appSecret: string;
	private readonly apiBase: string;
	private readonly proxyUrl?: string;

	private tokenValue = '';
	private tokenExpiresAt = 0;
	private refreshPromise: Promise<string> | null = null;

	constructor(opts: { appId: string; appSecret: string; proxyUrl?: string; apiBase?: string }) {
		this.appId = opts.appId;
		this.appSecret = opts.appSecret;
		this.proxyUrl = opts.proxyUrl;
		this.apiBase = opts.apiBase ?? 'https://open.feishu.cn/open-apis';
	}

	// -- public API --

	async createCard(cardJson: CardKitSchema): Promise<string> {
		const res = await this.api('POST', '/cardkit/v1/cards', {
			type: 'card_json',
			data: JSON.stringify(cardJson),
		});
		const cardId = res.data?.card_id;
		if (typeof cardId !== 'string') {
			throw new Error(`CardKit createCard: missing card_id (code=${res.code}, msg=${res.msg})`);
		}
		return cardId;
	}

	async updateElementContent(cardId: string, elementId: string, content: string, sequence: number): Promise<void> {
		await this.api('PUT', `/cardkit/v1/cards/${cardId}/elements/${elementId}/content`, {
			content,
			sequence,
			uuid: `s_${cardId}_${sequence}`,
		});
	}

	async closeStreaming(cardId: string, summary: string, sequence: number): Promise<void> {
		await this.api('PATCH', `/cardkit/v1/cards/${cardId}/settings`, {
			settings: JSON.stringify({
				config: { streaming_mode: false, summary: { content: summary } },
			}),
			sequence,
			uuid: `c_${cardId}_${sequence}`,
		});
	}

	async sendCardMessage(chatId: string, cardId: string, replyMessageId?: string): Promise<string> {
		const content = JSON.stringify({ type: 'card', data: { card_id: cardId } });
		let res: ApiResponse;
		if (replyMessageId) {
			res = await this.api('POST', `/im/v1/messages/${replyMessageId}/reply`, {
				msg_type: 'interactive',
				content,
			});
		} else {
			res = await this.api('POST', '/im/v1/messages?receive_id_type=chat_id', {
				receive_id: chatId,
				msg_type: 'interactive',
				content,
			});
		}
		const messageId = res.data?.message_id;
		if (typeof messageId !== 'string') {
			throw new Error(`CardKit sendCardMessage: missing message_id (code=${res.code}, msg=${res.msg})`);
		}
		return messageId;
	}

	// -- token management --

	private async getToken(): Promise<string> {
		if (this.tokenExpiresAt - Date.now() > 300_000) {
			return this.tokenValue;
		}
		if (this.refreshPromise) {
			return this.refreshPromise;
		}
		this.refreshPromise = this.refreshToken();
		try {
			return await this.refreshPromise;
		} finally {
			this.refreshPromise = null;
		}
	}

	private async refreshToken(): Promise<string> {
		const data = await requestJson<{
			code: number;
			msg: string;
			tenant_access_token?: string;
			expire?: number;
		}>(`${this.apiBase}/auth/v3/tenant_access_token/internal`, {
			method: 'POST',
			body: { app_id: this.appId, app_secret: this.appSecret },
			proxyUrl: this.proxyUrl,
		});
		if (data.code !== 0 || !data.tenant_access_token) {
			throw new Error(`CardKit token error: ${data.msg} (code=${data.code})`);
		}
		this.tokenValue = data.tenant_access_token;
		this.tokenExpiresAt = Date.now() + (data.expire ?? 7200) * 1000;
		return this.tokenValue;
	}

	// -- generic API call --

	private async api(method: string, urlPath: string, body: Record<string, unknown>, retry = 0): Promise<ApiResponse> {
		const token = await this.getToken();
		const res = await requestJson<ApiResponse>(`${this.apiBase}${urlPath}`, {
			method,
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${token}`,
			},
			body,
			proxyUrl: this.proxyUrl,
		});
		// 99991663 = token expired, retry once
		if (res.code === 99991663 && retry < 1) {
			this.tokenValue = '';
			this.tokenExpiresAt = 0;
			return this.api(method, urlPath, body, retry + 1);
		}
		if (res.code !== 0) {
			throw new Error(`CardKit API ${method} ${urlPath}: ${res.msg} (code=${res.code})`);
		}
		return res;
	}
}

// ---------------------------------------------------------------------------
// Streaming Session
// ---------------------------------------------------------------------------

const ELEMENT_ID = 'content';
const THROTTLE_MS = 100;
const MAX_ELEMENT_SIZE = 25_000; // 28KB limit, leave margin

export type ToolStatusEntry = {
	name: string;
	state: 'running' | 'completed' | 'error';
	detail?: string;
};

export class FeishuStreamingSession {
	private readonly client: FeishuCardKitClient;

	private cardId = '';
	private messageId = '';
	private sequence = 0;
	private currentText = '';
	private lastSentContent = '';
	private closed = false;
	private closing = false;
	private failed = false;
	private startPromise: Promise<void> | null = null;
	private queue: Promise<void> = Promise.resolve();
	private throttleTimer: ReturnType<typeof setTimeout> | null = null;
	private pendingUpdate: string | null = null;
	private toolStatuses: ToolStatusEntry[] = [];
	private todos: BotTodoListItem[] = [];

	constructor(client: FeishuCardKitClient) {
		this.client = client;
	}

	get isFailed(): boolean {
		return this.failed;
	}

	get isActive(): boolean {
		return this.cardId !== '' && !this.closed && !this.closing && !this.failed;
	}

	async start(chatId: string, replyMessageId?: string): Promise<void> {
		if (this.startPromise) {
			return await this.startPromise;
		}
		this.startPromise = (async () => {
			try {
				const cardJson: CardKitSchema = {
					schema: '2.0',
					config: {
						streaming_mode: true,
						summary: { content: '生成中...' },
						streaming_config: {
							print_frequency_ms: { default: 50 },
							print_step: { default: 5 },
						},
					},
					body: {
						elements: [
							{ tag: 'markdown', content: '⏳ 正在思考...', element_id: ELEMENT_ID },
						],
					},
				};

				this.cardId = await this.client.createCard(cardJson);
				this.messageId = await this.client.sendCardMessage(chatId, this.cardId, replyMessageId);
				this.sequence = 1;
				if ((this.currentText || this.toolStatuses.length > 0) && !this.closed && !this.closing) {
					this.scheduleUpdate();
				}
			} catch (error) {
				this.failed = true;
				console.warn('[feishu-cardkit] streaming session start failed:', error instanceof Error ? error.message : error);
			}
		})();
		await this.startPromise;
	}

	setToolStatus(name: string, state: 'running' | 'completed' | 'error', detail?: string): void {
		if (this.closed || this.closing || this.failed) return;
		const existing = this.toolStatuses.find((t) => t.name === name);
		if (existing) {
			existing.state = state;
			existing.detail = detail;
		} else {
			this.toolStatuses.push({ name, state, detail });
		}
		if (this.cardId) {
			this.scheduleUpdate();
		}
	}

	setTodos(todos: BotTodoListItem[]): void {
		if (this.closed || this.closing || this.failed) return;
		this.todos = todos.map((todo) => ({
			content: String(todo.content ?? '').trim(),
			status:
				todo.status === 'completed' || todo.status === 'in_progress' || todo.status === 'pending'
					? todo.status
					: 'pending',
			activeForm: String(todo.activeForm ?? '').trim() || undefined,
		}));
		if (this.cardId) {
			this.scheduleUpdate();
		}
	}

	update(fullText: string): void {
		if (this.closed || this.closing || this.failed) return;
		this.currentText = fullText;
		if (this.cardId) {
			this.scheduleUpdate();
		}
	}

	private scheduleUpdate(): void {
		const content = this.buildContent();
		this.pendingUpdate = content;
		if (this.throttleTimer) return;
		this.throttleTimer = setTimeout(() => {
			this.throttleTimer = null;
			const pending = this.pendingUpdate;
			if (pending !== null && pending !== this.lastSentContent) {
				this.pendingUpdate = null;
				this.enqueueUpdate(pending);
			}
		}, THROTTLE_MS);
	}

	async close(finalText?: string): Promise<void> {
		if (this.closed || this.closing) return;
		this.closing = true;
		if (finalText) {
			this.currentText = finalText;
		}
		if (this.startPromise) {
			await this.startPromise;
		}
		if (!this.cardId) {
			this.closed = true;
			return;
		}
		if (this.throttleTimer) {
			clearTimeout(this.throttleTimer);
			this.throttleTimer = null;
		}
		await this.queue;
		try {
			const content = this.buildContent();
			if (content !== this.lastSentContent) {
				this.sequence += 1;
				await this.client.updateElementContent(this.cardId, ELEMENT_ID, this.truncate(content), this.sequence);
			}
			const summary = this.buildSummary();
			this.sequence += 1;
			await this.client.closeStreaming(this.cardId, summary, this.sequence);
		} catch (error) {
			console.warn('[feishu-cardkit] close error:', error instanceof Error ? error.message : error);
		} finally {
			this.closed = true;
		}
	}

	private buildContent(): string {
		const sections: string[] = [];
		const hasVisibleOutput = this.currentText.trim().length > 0;
		const progressBlock = this.buildToolStatusBlock();
		if (!hasVisibleOutput && progressBlock) {
			sections.push(`### 执行进度\n${progressBlock}`);
		}
		const todoBlock = this.buildTodoBlock();
		if (todoBlock) {
			sections.push(`### TODO\n${todoBlock}`);
		}
		sections.push(`### 输出\n${this.currentText || '⏳ 正在思考...'}`);
		return sections.join('\n\n');
	}

	private buildToolStatusBlock(): string {
		if (this.toolStatuses.length === 0) return '⏳ 正在思考...';
		const icons: Record<string, string> = { running: '🔄', completed: '✅', error: '❌' };
		const latest = this.toolStatuses[this.toolStatuses.length - 1];
		const currentLine = latest?.detail?.trim()
			? `当前：${latest.detail.trim()}`
			: latest
				? `当前：${icons[latest.state] ?? '❔'} ${latest.name}`
				: '';
		const history = this.toolStatuses
			.slice(-6)
			.map((t) => `- ${icons[t.state] ?? '❔'} \`${t.name}\`${t.detail?.trim() ? `：${t.detail.trim()}` : ''}`)
			.join('\n');
		return [currentLine, history].filter(Boolean).join('\n');
	}

	private buildTodoBlock(): string {
		if (this.todos.length === 0) return '';
		const iconByStatus: Record<BotTodoListItem['status'], string> = {
			pending: '⬜',
			in_progress: '⏳',
			completed: '✅',
		};
		return this.todos
			.slice(0, 8)
			.map((todo) => {
				const label =
					todo.status === 'in_progress' && todo.activeForm?.trim()
						? todo.activeForm.trim()
						: todo.content;
				return `- ${iconByStatus[todo.status]} ${label}`;
			})
			.join('\n');
	}

	private buildSummary(): string {
		const textLen = this.currentText.length;
		if (textLen > 80) {
			return this.currentText.slice(0, 80) + '...';
		}
		return this.currentText || 'Done';
	}

	private truncate(content: string): string {
		if (content.length <= MAX_ELEMENT_SIZE) return content;
		return content.slice(0, MAX_ELEMENT_SIZE) + '\n\n...(内容过长，已截断)';
	}

	private enqueueUpdate(content: string): void {
		this.queue = this.queue.then(async () => {
			if (this.closed || this.failed) return;
			try {
				this.sequence += 1;
				await this.client.updateElementContent(this.cardId, ELEMENT_ID, this.truncate(content), this.sequence);
				this.lastSentContent = content;
			} catch (error) {
				console.warn('[feishu-cardkit] update error:', error instanceof Error ? error.message : error);
			}
		});
	}
}
