import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/messages';
import type { Part } from '@google/generative-ai';
import type { ResolvedUserMessage } from './sendResolved.js';

export type OpenAIContentPart =
	| { type: 'text'; text: string }
	| { type: 'image_url'; image_url: { url: string } };

export type OpenAIUserContent = string | OpenAIContentPart[];

function buildResolvedTextBody(resolved: ResolvedUserMessage): string {
	const prelude: string[] = [];
	const main: string[] = [];
	for (const segment of resolved.segments) {
		if (segment.kind === 'text') {
			main.push(segment.text);
		} else if (segment.kind === 'expanded_text_file') {
			prelude.push(
				segment.binary
					? `### 工作区文件: ${segment.relPath}\n${segment.body}\n`
					: `### 工作区文件: ${segment.relPath}\n\`\`\`\n${segment.body}\n\`\`\`\n`
			);
		} else if (segment.kind === 'missing_file') {
			main.push(`[missing: ${segment.relPath}]`);
		} else if (segment.kind === 'image_error') {
			main.push(`[image error (${segment.error.kind}): ${segment.relPath}]`);
		}
	}
	return [prelude.join('\n'), prelude.length > 0 ? '---\n' : '', main.join('')]
		.filter((value) => value.length > 0)
		.join('\n');
}

export function buildOpenAIUserContent(resolved: ResolvedUserMessage): OpenAIUserContent {
	const parts: OpenAIContentPart[] = [];
	const textBody = buildResolvedTextBody(resolved);
	if (textBody.length > 0) {
		parts.push({ type: 'text', text: textBody });
	}
	for (const segment of resolved.segments) {
		if (segment.kind === 'image_asset') {
			parts.push({
				type: 'image_url',
				image_url: {
					url: `data:${segment.asset.mimeType};base64,${segment.asset.buffer.toString('base64')}`,
				},
			});
		}
	}
	if (parts.length === 0) {
		return '';
	}
	if (parts.length === 1 && parts[0]!.type === 'text') {
		return parts[0]!.text;
	}
	return parts;
}

export function buildAnthropicUserBlocks(resolved: ResolvedUserMessage): ContentBlockParam[] {
	const blocks: ContentBlockParam[] = [];
	const textBody = buildResolvedTextBody(resolved);
	if (textBody.length > 0) {
		blocks.push({ type: 'text', text: textBody });
	}
	for (const segment of resolved.segments) {
		if (segment.kind === 'image_asset') {
			blocks.push({
				type: 'image',
				source: {
					type: 'base64',
					media_type: segment.asset.mimeType,
					data: segment.asset.buffer.toString('base64'),
				},
			});
		}
	}
	return blocks;
}

export function buildGeminiUserParts(resolved: ResolvedUserMessage): Part[] {
	const parts: Part[] = [];
	const textBody = buildResolvedTextBody(resolved);
	if (textBody.length > 0) {
		parts.push({ text: textBody });
	}
	for (const segment of resolved.segments) {
		if (segment.kind === 'image_asset') {
			parts.push({
				inlineData: {
					mimeType: segment.asset.mimeType,
					data: segment.asset.buffer.toString('base64'),
				},
			});
		}
	}
	if (parts.length === 0) {
		parts.push({ text: '' });
	}
	return parts;
}
