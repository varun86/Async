import { parseLeadingWorkspaceRefs } from './composerAtMention';

/** 与 Cursor 类似的斜杠命令 chip，当前仅支持创建 Skill */
export type SlashCommandId = 'create-skill';

export const CREATE_SKILL_SLUG: SlashCommandId = 'create-skill';
export const CREATE_SKILL_WIRE = '/create-skill';

export type ComposerSegment =
	| { id: string; kind: 'text'; text: string }
	| { id: string; kind: 'file'; path: string }
	| { id: string; kind: 'command'; command: SlashCommandId };

export function newSegmentId(): string {
	return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function mergeAdjacentText(segments: ComposerSegment[]): ComposerSegment[] {
	const out: ComposerSegment[] = [];
	for (const s of segments) {
		if (s.kind === 'text' && s.text === '') {
			continue;
		}
		const last = out[out.length - 1];
		if (s.kind === 'text' && last?.kind === 'text') {
			last.text += s.text;
		} else {
			out.push(s);
		}
	}
	return out;
}

const SEG_CONTENT_KEY_SEP = '\u241e';

/** 对比 props 与 DOM 读回是否同一内容（忽略 segment id）；纯文本 `/create-skill` 与 command chip 的 key 不同 */
export function segmentsContentKey(segments: ComposerSegment[]): string {
	const norm = mergeAdjacentText(segments);
	return norm
		.map((s) => {
			if (s.kind === 'text') {
				return `t:${s.text}`;
			}
			if (s.kind === 'file') {
				return `f:${s.path}`;
			}
			return `c:${s.command}`;
		})
		.join(SEG_CONTENT_KEY_SEP);
}

/** props 已是 /create-skill chip，DOM 仍为纯文本 `/create-skill…`（含无空格紧贴后缀） */
export function isSlashCommandDomPendingUpgrade(
	segments: ComposerSegment[],
	domSegs: ComposerSegment[]
): boolean {
	const norm = mergeAdjacentText(segments);
	const p0 = norm[0];
	const d0 = domSegs[0];
	if (p0?.kind !== 'command' || p0.command !== CREATE_SKILL_SLUG) {
		return false;
	}
	if (d0?.kind !== 'text') {
		return false;
	}
	const tx = d0.text;
	return tx === CREATE_SKILL_WIRE || tx.startsWith(`${CREATE_SKILL_WIRE}`);
}

/**
 * 文件引用与紧随其后的正文之间插入 ZWNJ，避免 `@path` 与后续字符被拼成一段后，
 * `wirePlainToSegments` 用最长前缀匹配时把正文吃进路径（例如 `@foo.tshello`）。
 */
const FILE_REF_BOUNDARY = '\u200c';

/** 发送给后端的纯文本：与内联 chip 顺序一致 */
export function segmentsToWireText(segments: ComposerSegment[]): string {
	let out = '';
	for (let k = 0; k < segments.length; k++) {
		const s = segments[k]!;
		if (s.kind === 'text') {
			out += s.text;
		} else if (s.kind === 'command' && s.command === CREATE_SKILL_SLUG) {
			out += CREATE_SKILL_WIRE;
			const next = segments[k + 1];
			if (next?.kind === 'text' && next.text.length > 0 && !/^\s/u.test(next.text)) {
				out += FILE_REF_BOUNDARY;
			} else if (next?.kind === 'file') {
				out += FILE_REF_BOUNDARY;
			}
		} else {
			out += `@${s.path}`;
			const next = segments[k + 1];
			if (next?.kind === 'text' && next.text.length > 0 && !/^\s/u.test(next.text)) {
				out += FILE_REF_BOUNDARY;
			}
		}
	}
	return out;
}

/** 将用户消息解析为 segments（兼容旧版「首行全是 @路径」格式） */
export function userMessageToSegments(content: string, knownPaths: string[]): ComposerSegment[] {
	const trimmedStart = content.replace(/^\uFEFF/, '');
	if (trimmedStart.startsWith(CREATE_SKILL_WIRE)) {
		let rest = trimmedStart.slice(CREATE_SKILL_WIRE.length);
		if (rest.startsWith(FILE_REF_BOUNDARY)) {
			rest = rest.slice(1);
		} else {
			rest = rest.replace(/^\s+/, '');
		}
		const tailSegs = rest.length > 0 ? wirePlainToSegments(rest, knownPaths) : [];
		return mergeAdjacentText([
			{ id: newSegmentId(), kind: 'command', command: CREATE_SKILL_SLUG },
			...tailSegs,
		]);
	}
	const legacy = parseLeadingWorkspaceRefs(content);
	if (legacy.refs.length > 0) {
		const parts: ComposerSegment[] = legacy.refs.map((p) => ({
			id: newSegmentId(),
			kind: 'file' as const,
			path: p,
		}));
		if (legacy.body) {
			parts.push({ id: newSegmentId(), kind: 'text', text: legacy.body });
		}
		return mergeAdjacentText(parts);
	}
	return wirePlainToSegments(content, knownPaths);
}

/** 按最长路径匹配内联 `@相对路径` */
export function wirePlainToSegments(text: string, knownPaths: string[]): ComposerSegment[] {
	const paths = [...new Set(knownPaths.map((p) => p.replace(/\\/g, '/')))].sort((a, b) => b.length - a.length);
	const out: ComposerSegment[] = [];
	let i = 0;
	let textBuf = '';
	const flush = () => {
		if (textBuf) {
			out.push({ id: newSegmentId(), kind: 'text', text: textBuf });
			textBuf = '';
		}
	};
	while (i < text.length) {
		if (text[i] === '@' || text[i] === '\uFF03') {
			const rest = text.slice(i + 1);
			const hit = paths.find((p) => rest.startsWith(p));
			if (hit) {
				flush();
				out.push({ id: newSegmentId(), kind: 'file', path: hit });
				i += 1 + hit.length;
				while (text[i] === '\u200c' || text[i] === '\u200b') {
					i += 1;
				}
				continue;
			}
		}
		let j = i + 1;
		while (j < text.length && text[j] !== '@' && text[j] !== '\uFF03') {
			j++;
		}
		textBuf += text.slice(i, j);
		i = j;
	}
	flush();
	return mergeAdjacentText(out);
}

export function segmentsTrimmedEmpty(segments: ComposerSegment[]): boolean {
	if (segments.length === 0) {
		return true;
	}
	const first = segments[0];
	if (first?.kind === 'command' && first.command === CREATE_SKILL_SLUG) {
		const tail = segments.slice(1);
		return segmentsToWireText(tail).trim().length === 0;
	}
	return segmentsToWireText(segments).trim().length === 0;
}

export function isCreateSkillComposerTurn(segments: ComposerSegment[]): boolean {
	const s = segments[0];
	return s?.kind === 'command' && s.command === CREATE_SKILL_SLUG;
}
