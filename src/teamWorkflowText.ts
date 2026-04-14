import { flattenAssistantTextPartsForSearch } from './agentStructuredMessage';

function normalizeNarrativeText(text: string): string {
	return text.replace(/\n{3,}/g, '\n\n').trim();
}

function stripFencedBlocks(text: string): string {
	return text.replace(/```[\s\S]*?```/g, '').trim();
}

function stripTrailingRawJson(text: string): string {
	const normalized = text.trim();
	if (!normalized) {
		return '';
	}

	const lines = normalized.split('\n');
	const rawJsonStart = lines.findIndex((line, index) => {
		if (index === 0) {
			return false;
		}
		return /^[\s]*[\[{]/.test(line);
	});

	if (rawJsonStart <= 0) {
		return normalized;
	}

	return lines.slice(0, rawJsonStart).join('\n').trim();
}

const TEAM_LEAD_MODE_MARKER_RE = /^\s*(?:[*_`>#-]+\s*)*MODE\s*:\s*[A-Z_]+\s*(?:[*_`]+)?\s*\n?/i;
const TEAM_LEAD_MODE_MARKER_LINE_RE =
	/^\s*(?:[*_`>#-]+\s*)*MODE\s*:\s*[A-Z_]+\s*(?:[*_`]+)?\s*$/gim;
const TEAM_LEAD_MODE_MARKER_INLINE_RE = /\bMODE\s*:\s*[A-Z_]+\b/gi;

export function stripTeamModeMarkers(text: string): string {
	return String(text ?? '')
		.replace(TEAM_LEAD_MODE_MARKER_RE, '')
		.replace(TEAM_LEAD_MODE_MARKER_LINE_RE, '')
		.replace(TEAM_LEAD_MODE_MARKER_INLINE_RE, '')
		.replace(/[ \t]{2,}/g, ' ')
		.replace(/\n[ \t]+\n/g, '\n\n')
		.replace(/\n{3,}/g, '\n\n')
		.trim();
}

export function extractTeamLeadNarrative(summary: string): string {
	const text = flattenAssistantTextPartsForSearch(String(summary ?? '')).trim();
	if (!text) {
		return '';
	}

	const withoutMode = stripTeamModeMarkers(text);
	const withoutFence = stripFencedBlocks(withoutMode);
	const withoutRawJson = stripTrailingRawJson(withoutFence || withoutMode);

	return normalizeNarrativeText(withoutRawJson || withoutFence || withoutMode);
}
