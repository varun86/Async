import type { AgentToolDef } from './agentTools.js';

const MAX_SCHEMA_CACHE_ENTRIES = 64;

type OpenAIToolSchema = {
	type: 'function';
	function: {
		name: string;
		description: string;
		parameters: Record<string, unknown>;
	};
};

type AnthropicToolSchema = {
	name: string;
	description: string;
	input_schema: Record<string, unknown>;
};

const openAiToolSchemaCache = new Map<string, OpenAIToolSchema[]>();
const anthropicToolSchemaCache = new Map<string, AnthropicToolSchema[]>();

function cacheSet<T>(cache: Map<string, T>, key: string, value: T): T {
	if (cache.has(key)) {
		cache.delete(key);
	}
	cache.set(key, value);
	if (cache.size > MAX_SCHEMA_CACHE_ENTRIES) {
		const oldest = cache.keys().next().value;
		if (typeof oldest === 'string') {
			cache.delete(oldest);
		}
	}
	return value;
}

function normalizeUnknown(value: unknown, parentKey = ''): unknown {
	if (Array.isArray(value)) {
		const items = value.map((item) => normalizeUnknown(item));
		if (parentKey === 'required' && items.every((item) => typeof item === 'string')) {
			return [...(items as string[])].sort((a, b) => a.localeCompare(b));
		}
		return items;
	}
	if (!value || typeof value !== 'object') {
		return value;
	}
	const entries = Object.entries(value as Record<string, unknown>)
		.filter(([, v]) => v !== undefined)
		.sort(([a], [b]) => a.localeCompare(b));
	return Object.fromEntries(entries.map(([key, item]) => [key, normalizeUnknown(item, key)]));
}

function normalizeAgentToolDef(def: AgentToolDef): AgentToolDef {
	return {
		name: def.name,
		description: def.description,
		parameters: normalizeUnknown(def.parameters) as AgentToolDef['parameters'],
	};
}

function normalizeToolDefs(defs: AgentToolDef[]): AgentToolDef[] {
	return defs.map(normalizeAgentToolDef);
}

function toolDefsSignature(defs: AgentToolDef[]): string {
	return JSON.stringify(normalizeToolDefs(defs));
}

export function buildCachedOpenAITools(defs: AgentToolDef[]): OpenAIToolSchema[] {
	const signature = toolDefsSignature(defs);
	const cached = openAiToolSchemaCache.get(signature);
	if (cached) {
		return cached;
	}
	const normalized = normalizeToolDefs(defs);
	return cacheSet(
		openAiToolSchemaCache,
		signature,
		normalized.map((def) => ({
			type: 'function' as const,
			function: {
				name: def.name,
				description: def.description,
				parameters: def.parameters as Record<string, unknown>,
			},
		}))
	);
}

export function buildCachedAnthropicTools(defs: AgentToolDef[]): AnthropicToolSchema[] {
	const signature = toolDefsSignature(defs);
	const cached = anthropicToolSchemaCache.get(signature);
	if (cached) {
		return cached;
	}
	const normalized = normalizeToolDefs(defs);
	return cacheSet(
		anthropicToolSchemaCache,
		signature,
		normalized.map((def) => ({
			name: def.name,
			description: def.description,
			input_schema: def.parameters as Record<string, unknown>,
		}))
	);
}
