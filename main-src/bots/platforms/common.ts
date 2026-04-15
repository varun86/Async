import * as http from 'node:http';
import * as https from 'node:https';
import { HttpsProxyAgent } from 'https-proxy-agent';
import type { BotIntegrationConfig } from '../../botSettingsTypes.js';
import type { BotInboundMessage } from '../botRuntime.js';

export type PlatformInboundEnvelope = BotInboundMessage & {
	reply: (text: string) => Promise<void>;
};

export type PlatformMessageHandler = (message: PlatformInboundEnvelope) => Promise<void>;

export type BotPlatformAdapter = {
	start(onMessage: PlatformMessageHandler): Promise<void>;
	stop(): Promise<void>;
};

export function splitPlainText(text: string, maxLength: number): string[] {
	const normalized = String(text ?? '').replace(/\r\n/g, '\n').trim();
	if (!normalized) {
		return ['(empty)'];
	}
	if (normalized.length <= maxLength) {
		return [normalized];
	}
	const chunks: string[] = [];
	let rest = normalized;
	while (rest.length > maxLength) {
		const slice = rest.slice(0, maxLength);
		const breakAt = Math.max(slice.lastIndexOf('\n\n'), slice.lastIndexOf('\n'), slice.lastIndexOf(' '));
		const cut = breakAt > maxLength * 0.5 ? breakAt : maxLength;
		chunks.push(rest.slice(0, cut).trim());
		rest = rest.slice(cut).trim();
	}
	if (rest) {
		chunks.push(rest);
	}
	return chunks.filter(Boolean);
}

export function safeJsonParse<T>(raw: string): T | null {
	try {
		return JSON.parse(raw) as T;
	} catch {
		return null;
	}
}

export function websocketMessageToText(raw: unknown): string {
	if (typeof raw === 'string') {
		return raw;
	}
	if (Buffer.isBuffer(raw)) {
		return raw.toString('utf8');
	}
	if (raw instanceof ArrayBuffer) {
		return Buffer.from(raw).toString('utf8');
	}
	if (Array.isArray(raw)) {
		return Buffer.concat(raw.map((chunk) => (Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)))).toString('utf8');
	}
	return String(raw ?? '');
}

export function resolveIntegrationProxyUrl(integration: BotIntegrationConfig): string | undefined {
	switch (integration.platform) {
		case 'telegram':
			return integration.telegram?.proxyUrl?.trim() || undefined;
		case 'slack':
			return integration.slack?.proxyUrl?.trim() || undefined;
		case 'discord':
			return integration.discord?.proxyUrl?.trim() || undefined;
		case 'feishu':
			return integration.feishu?.proxyUrl?.trim() || undefined;
		default:
			return undefined;
	}
}

export function createProxyAgent(proxyUrl?: string): InstanceType<typeof HttpsProxyAgent> | undefined {
	const trimmed = proxyUrl?.trim();
	if (!trimmed) {
		return undefined;
	}
	return new HttpsProxyAgent(trimmed);
}

type JsonPrimitive = string | number | boolean;

type JsonRequestOptions = {
	method?: string;
	headers?: Record<string, string | undefined>;
	body?: unknown;
	timeoutMs?: number;
	proxyUrl?: string;
	signal?: AbortSignal;
};

type HttpInstanceRequestOptions = {
	url: string;
	method?: string;
	headers?: Record<string, string | undefined>;
	params?: Record<string, JsonPrimitive | null | undefined>;
	data?: unknown;
	timeout?: number;
};

function appendQueryParams(url: string, params?: Record<string, JsonPrimitive | null | undefined>): string {
	if (!params || Object.keys(params).length === 0) {
		return url;
	}
	const parsed = new URL(url);
	for (const [key, value] of Object.entries(params)) {
		if (value === null || value === undefined) {
			continue;
		}
		parsed.searchParams.set(key, String(value));
	}
	return parsed.toString();
}

function normalizeHeaders(input?: Record<string, string | undefined>): Record<string, string> {
	const headers: Record<string, string> = {};
	for (const [key, value] of Object.entries(input ?? {})) {
		if (value === undefined) {
			continue;
		}
		headers[key] = value;
	}
	return headers;
}

function hasHeader(headers: Record<string, string>, name: string): boolean {
	const target = name.toLowerCase();
	return Object.keys(headers).some((key) => key.toLowerCase() === target);
}

export async function requestJson<T>(url: string, options: JsonRequestOptions = {}): Promise<T> {
	const target = new URL(url);
	const proxyAgent = createProxyAgent(options.proxyUrl);
	const headers = normalizeHeaders(options.headers);
	const payload =
		options.body === undefined
			? undefined
			: typeof options.body === 'string' || Buffer.isBuffer(options.body)
				? options.body
				: JSON.stringify(options.body);
	if (payload !== undefined && !hasHeader(headers, 'content-type') && !Buffer.isBuffer(payload)) {
		headers['content-type'] = 'application/json';
	}
	if (payload !== undefined && !hasHeader(headers, 'content-length')) {
		headers['content-length'] = Buffer.byteLength(payload).toString();
	}

	return await new Promise<T>((resolve, reject) => {
		const requestImpl = target.protocol === 'http:' ? http.request : https.request;
		const req = requestImpl(
			target,
			{
				method: options.method ?? (payload === undefined ? 'GET' : 'POST'),
				headers,
				agent: proxyAgent,
			},
			(response) => {
				const chunks: Buffer[] = [];
				response.on('data', (chunk) => {
					chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
				});
				response.on('end', () => {
					const raw = Buffer.concat(chunks).toString('utf8');
					const status = response.statusCode ?? 0;
					if (status < 200 || status >= 300) {
						const detail = raw.trim().slice(0, 240);
						reject(new Error(`Request failed: ${status}${detail ? ` ${detail}` : ''}`));
						return;
					}
					if (!raw.trim()) {
						resolve({} as T);
						return;
					}
					try {
						resolve(JSON.parse(raw) as T);
					} catch {
						reject(new Error('Request returned non-JSON response.'));
					}
				});
			}
		);

		const timeoutMs = options.timeoutMs ?? 30_000;
		req.setTimeout(timeoutMs, () => {
			req.destroy(new Error(`Request timed out after ${timeoutMs}ms.`));
		});

		const onAbort = () => {
			req.destroy(new Error('Request aborted.'));
		};
		if (options.signal) {
			if (options.signal.aborted) {
				onAbort();
			} else {
				options.signal.addEventListener('abort', onAbort, { once: true });
			}
		}

		req.on('error', (error) => {
			if (options.signal) {
				options.signal.removeEventListener('abort', onAbort);
			}
			reject(error);
		});
		req.on('close', () => {
			if (options.signal) {
				options.signal.removeEventListener('abort', onAbort);
			}
		});

		if (payload !== undefined) {
			req.write(payload);
		}
		req.end();
	});
}

export function createJsonHttpInstance(proxyUrl?: string) {
	const request = async <T = any>(options: HttpInstanceRequestOptions): Promise<T> =>
		await requestJson<T>(appendQueryParams(options.url, options.params), {
			method: options.method,
			headers: options.headers,
			body: options.data,
			timeoutMs: options.timeout,
			proxyUrl,
		});

	return {
		request,
		get: async <T = any>(url: string, options?: Omit<HttpInstanceRequestOptions, 'url' | 'method'>) =>
			await request<T>({ ...(options ?? {}), url, method: 'GET' }),
		delete: async <T = any>(url: string, options?: Omit<HttpInstanceRequestOptions, 'url' | 'method'>) =>
			await request<T>({ ...(options ?? {}), url, method: 'DELETE' }),
		head: async <T = any>(url: string, options?: Omit<HttpInstanceRequestOptions, 'url' | 'method'>) =>
			await request<T>({ ...(options ?? {}), url, method: 'HEAD' }),
		options: async <T = any>(url: string, options?: Omit<HttpInstanceRequestOptions, 'url' | 'method'>) =>
			await request<T>({ ...(options ?? {}), url, method: 'OPTIONS' }),
		post: async <T = any>(url: string, data?: unknown, options?: Omit<HttpInstanceRequestOptions, 'url' | 'method' | 'data'>) =>
			await request<T>({ ...(options ?? {}), url, method: 'POST', data }),
		put: async <T = any>(url: string, data?: unknown, options?: Omit<HttpInstanceRequestOptions, 'url' | 'method' | 'data'>) =>
			await request<T>({ ...(options ?? {}), url, method: 'PUT', data }),
		patch: async <T = any>(url: string, data?: unknown, options?: Omit<HttpInstanceRequestOptions, 'url' | 'method' | 'data'>) =>
			await request<T>({ ...(options ?? {}), url, method: 'PATCH', data }),
	};
}
