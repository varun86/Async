import sharp from 'sharp';

export const IMAGE_LONG_EDGE_CAP = 2048;
export const IMAGE_TARGET_BYTES = 4 * 1024 * 1024;
const JPEG_QUALITY_DEFAULT = 85;
const JPEG_QUALITY_FLOOR = 40;

export type ProcessedImage = {
	mimeType: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif';
	buffer: Buffer;
	sizeBytes: number;
	width: number;
	height: number;
};

export type ImageProcessError =
	| { kind: 'unsupported_format'; detail: string }
	| { kind: 'decode_failed'; detail: string }
	| { kind: 'too_large_after_downscale'; detail: string }
	| { kind: 'io_error'; detail: string };

export type ImageProcessResult =
	| { ok: true; image: ProcessedImage }
	| { ok: false; error: ImageProcessError };

const SUPPORTED_FORMATS: Record<string, ProcessedImage['mimeType']> = {
	png: 'image/png',
	jpeg: 'image/jpeg',
	jpg: 'image/jpeg',
	webp: 'image/webp',
	gif: 'image/gif',
};

function formatFromSharpFormat(fmt: string | undefined): ProcessedImage['mimeType'] | null {
	if (!fmt) {
		return null;
	}
	return SUPPORTED_FORMATS[fmt.toLowerCase()] ?? null;
}

export async function preprocessImageForSend(input: Buffer): Promise<ImageProcessResult> {
	if (!Buffer.isBuffer(input) || input.length === 0) {
		return { ok: false, error: { kind: 'decode_failed', detail: 'empty buffer' } };
	}
	let meta: sharp.Metadata;
	try {
		meta = await sharp(input).metadata();
	} catch (err) {
		return {
			ok: false,
			error: { kind: 'decode_failed', detail: err instanceof Error ? err.message : String(err) },
		};
	}
	const sourceMime = formatFromSharpFormat(meta.format);
	if (!sourceMime) {
		return {
			ok: false,
			error: { kind: 'unsupported_format', detail: String(meta.format ?? 'unknown') },
		};
	}

	const origW = meta.width ?? 0;
	const origH = meta.height ?? 0;
	if (origW <= 0 || origH <= 0) {
		return {
			ok: false,
			error: { kind: 'decode_failed', detail: 'missing dimensions' },
		};
	}

	const hasAlpha = !!meta.hasAlpha;

	// GIF: pass through untouched (animated GIFs need frame preservation).
	if (sourceMime === 'image/gif') {
		if (input.length > IMAGE_TARGET_BYTES) {
			return {
				ok: false,
				error: {
					kind: 'too_large_after_downscale',
					detail: `gif ${input.length} bytes exceeds ${IMAGE_TARGET_BYTES}`,
				},
			};
		}
		return {
			ok: true,
			image: {
				mimeType: 'image/gif',
				buffer: input,
				sizeBytes: input.length,
				width: origW,
				height: origH,
			},
		};
	}

	const longEdge = Math.max(origW, origH);
	const scale = longEdge > IMAGE_LONG_EDGE_CAP ? IMAGE_LONG_EDGE_CAP / longEdge : 1;
	const targetW = Math.max(1, Math.round(origW * scale));
	const targetH = Math.max(1, Math.round(origH * scale));

	let attempt = 0;
	let width = targetW;
	let height = targetH;
	let quality = JPEG_QUALITY_DEFAULT;

	while (attempt < 6) {
		let pipeline = sharp(input);
		if (width !== origW || height !== origH) {
			pipeline = pipeline.resize({ width, height, fit: 'inside', withoutEnlargement: true });
		}
		let outMime: ProcessedImage['mimeType'];
		let out: Buffer;
		try {
			if (hasAlpha) {
				outMime = 'image/png';
				out = await pipeline.png({ compressionLevel: 9 }).toBuffer();
			} else {
				outMime = 'image/jpeg';
				out = await pipeline.jpeg({ quality, mozjpeg: true }).toBuffer();
			}
		} catch (err) {
			return {
				ok: false,
				error: { kind: 'decode_failed', detail: err instanceof Error ? err.message : String(err) },
			};
		}
		if (out.length <= IMAGE_TARGET_BYTES) {
			return {
				ok: true,
				image: { mimeType: outMime, buffer: out, sizeBytes: out.length, width, height },
			};
		}
		attempt += 1;
		if (!hasAlpha && quality > JPEG_QUALITY_FLOOR) {
			quality = Math.max(JPEG_QUALITY_FLOOR, quality - 15);
			continue;
		}
		if (Math.max(width, height) > 512) {
			width = Math.max(1, Math.round(width * 0.75));
			height = Math.max(1, Math.round(height * 0.75));
			continue;
		}
		break;
	}

	return {
		ok: false,
		error: {
			kind: 'too_large_after_downscale',
			detail: `cannot fit image under ${IMAGE_TARGET_BYTES} bytes after ${attempt} attempts`,
		},
	};
}
