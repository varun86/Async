export type UiFontPresetId = 'apple' | 'inter' | 'segoe';
export type CodeFontPresetId = 'sfmono' | 'monospace' | 'jetbrains';
export type ThemePresetId = 'codex' | 'graphite' | 'midnight';

export type AppearanceThemePreset = {
	accentColor: string;
	backgroundColor: string;
	foregroundColor: string;
	contrast: number;
	translucentSidebar: boolean;
};

export type AppAppearanceSettings = {
	themePreset: ThemePresetId | 'custom';
	accentColor: string;
	backgroundColor: string;
	foregroundColor: string;
	uiFontPreset: UiFontPresetId;
	codeFontPreset: CodeFontPresetId;
	translucentSidebar: boolean;
	contrast: number;
	usePointerCursors: boolean;
	uiFontSize: number;
	codeFontSize: number;
};

export const APPLE_UI_FONT_STACK =
	'-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Helvetica Neue", sans-serif';
export const INTER_UI_FONT_STACK =
	'"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
export const SEGOE_UI_FONT_STACK =
	'"Segoe UI Variable", "Segoe UI", -apple-system, BlinkMacSystemFont, sans-serif';

export const SFMONO_CODE_FONT_STACK =
	'ui-monospace, "SF Mono", "SFMono-Regular", Menlo, Monaco, Consolas, monospace';
export const MONOSPACE_CODE_FONT_STACK =
	'ui-monospace, "Cascadia Code", Consolas, "Courier New", monospace';
export const JETBRAINS_CODE_FONT_STACK =
	'"JetBrains Mono", "Cascadia Code", "SF Mono", Consolas, monospace';

export const APPEARANCE_THEME_PRESETS: Record<ThemePresetId, AppearanceThemePreset> = {
	codex: {
		accentColor: '#0169CC',
		backgroundColor: '#111111',
		foregroundColor: '#FCFCFC',
		contrast: 60,
		translucentSidebar: true,
	},
	graphite: {
		accentColor: '#6D7CFF',
		backgroundColor: '#17181C',
		foregroundColor: '#F3F4F6',
		contrast: 54,
		translucentSidebar: true,
	},
	midnight: {
		accentColor: '#00AE59',
		backgroundColor: '#0B1220',
		foregroundColor: '#EEF6FF',
		contrast: 68,
		translucentSidebar: true,
	},
};

export function defaultAppearanceSettings(): AppAppearanceSettings {
	const preset = APPEARANCE_THEME_PRESETS.codex;
	return {
		themePreset: 'codex',
		accentColor: preset.accentColor,
		backgroundColor: preset.backgroundColor,
		foregroundColor: preset.foregroundColor,
		uiFontPreset: 'apple',
		codeFontPreset: 'sfmono',
		translucentSidebar: preset.translucentSidebar,
		contrast: preset.contrast,
		usePointerCursors: false,
		uiFontSize: 13,
		codeFontSize: 12,
	};
}

export function normalizeUiFontPreset(raw: unknown): UiFontPresetId {
	if (raw === 'apple' || raw === 'inter' || raw === 'segoe') {
		return raw;
	}
	return 'apple';
}

export function normalizeCodeFontPreset(raw: unknown): CodeFontPresetId {
	if (raw === 'sfmono' || raw === 'monospace' || raw === 'jetbrains') {
		return raw;
	}
	return 'sfmono';
}

export function normalizeThemePreset(raw: unknown): ThemePresetId | 'custom' {
	if (raw === 'codex' || raw === 'graphite' || raw === 'midnight' || raw === 'custom') {
		return raw;
	}
	return 'codex';
}

function clamp(n: number, min: number, max: number): number {
	return Math.min(Math.max(n, min), max);
}

function normalizeBoolean(raw: unknown, fallback: boolean): boolean {
	return typeof raw === 'boolean' ? raw : fallback;
}

function normalizeNumber(raw: unknown, fallback: number, min: number, max: number): number {
	return typeof raw === 'number' && Number.isFinite(raw) ? clamp(Math.round(raw), min, max) : fallback;
}

function normalizeHexColor(raw: unknown, fallback: string): string {
	const s = String(raw ?? '').trim();
	if (/^#[0-9a-fA-F]{6}$/.test(s)) {
		return s.toUpperCase();
	}
	if (/^#[0-9a-fA-F]{3}$/.test(s)) {
		const digits = s.slice(1).split('');
		return (`#${digits.map((d) => d + d).join('')}`).toUpperCase();
	}
	return fallback.toUpperCase();
}

export function normalizeAppearanceSettings(raw?: Partial<Record<string, unknown>> | null): AppAppearanceSettings {
	const defaults = defaultAppearanceSettings();
	return {
		themePreset: normalizeThemePreset(raw?.themePreset),
		accentColor: normalizeHexColor(raw?.accentColor, defaults.accentColor),
		backgroundColor: normalizeHexColor(raw?.backgroundColor, defaults.backgroundColor),
		foregroundColor: normalizeHexColor(raw?.foregroundColor, defaults.foregroundColor),
		uiFontPreset: normalizeUiFontPreset(raw?.uiFontPreset ?? raw?.fontPreset),
		codeFontPreset: normalizeCodeFontPreset(raw?.codeFontPreset),
		translucentSidebar: normalizeBoolean(raw?.translucentSidebar, defaults.translucentSidebar),
		contrast: normalizeNumber(raw?.contrast, defaults.contrast, 0, 100),
		usePointerCursors: normalizeBoolean(raw?.usePointerCursors, defaults.usePointerCursors),
		uiFontSize: normalizeNumber(raw?.uiFontSize, defaults.uiFontSize, 11, 18),
		codeFontSize: normalizeNumber(raw?.codeFontSize, defaults.codeFontSize, 11, 18),
	};
}

export function resolveUiFontFamily(preset: UiFontPresetId): string {
	switch (preset) {
		case 'inter':
			return INTER_UI_FONT_STACK;
		case 'segoe':
			return SEGOE_UI_FONT_STACK;
		case 'apple':
		default:
			return APPLE_UI_FONT_STACK;
	}
}

export function resolveCodeFontFamily(preset: CodeFontPresetId): string {
	switch (preset) {
		case 'monospace':
			return MONOSPACE_CODE_FONT_STACK;
		case 'jetbrains':
			return JETBRAINS_CODE_FONT_STACK;
		case 'sfmono':
		default:
			return SFMONO_CODE_FONT_STACK;
	}
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
	const normalized = normalizeHexColor(hex, '#000000').slice(1);
	return {
		r: Number.parseInt(normalized.slice(0, 2), 16),
		g: Number.parseInt(normalized.slice(2, 4), 16),
		b: Number.parseInt(normalized.slice(4, 6), 16),
	};
}

function rgbToHex(rgb: { r: number; g: number; b: number }): string {
	return `#${[rgb.r, rgb.g, rgb.b]
		.map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0'))
		.join('')}`.toUpperCase();
}

function mixHex(base: string, target: string, targetWeight: number): string {
	const a = hexToRgb(base);
	const b = hexToRgb(target);
	const w = Math.min(Math.max(targetWeight, 0), 1);
	return rgbToHex({
		r: a.r * (1 - w) + b.r * w,
		g: a.g * (1 - w) + b.g * w,
		b: a.b * (1 - w) + b.b * w,
	});
}

function hexToRgba(hex: string, alpha: number): string {
	const { r, g, b } = hexToRgb(hex);
	return `rgba(${r}, ${g}, ${b}, ${Math.min(Math.max(alpha, 0), 1).toFixed(3)})`;
}

function relativeLuminance(hex: string): number {
	const { r, g, b } = hexToRgb(hex);
	const linear = [r, g, b].map((v) => {
		const channel = v / 255;
		return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
	});
	return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function accentContrast(hex: string): string {
	return relativeLuminance(hex) > 0.45 ? '#111111' : '#FCFCFC';
}

export function applyThemePreset(settings: AppAppearanceSettings, presetId: ThemePresetId): AppAppearanceSettings {
	const preset = APPEARANCE_THEME_PRESETS[presetId];
	return {
		...settings,
		themePreset: presetId,
		accentColor: preset.accentColor,
		backgroundColor: preset.backgroundColor,
		foregroundColor: preset.foregroundColor,
		contrast: preset.contrast,
		translucentSidebar: preset.translucentSidebar,
	};
}

export function applyAppearanceSettingsToDom(settings: AppAppearanceSettings): void {
	if (typeof document === 'undefined') {
		return;
	}

	const contrastBoost = settings.contrast / 100;
	const bg0 = normalizeHexColor(settings.backgroundColor, '#111111');
	const fg0 = normalizeHexColor(settings.foregroundColor, '#FCFCFC');
	const accent = normalizeHexColor(settings.accentColor, '#0169CC');
	const bg1 = mixHex(bg0, fg0, 0.03 + contrastBoost * 0.035);
	const bg2 = mixHex(bg0, fg0, 0.06 + contrastBoost * 0.055);
	const bg3 = mixHex(bg0, fg0, 0.1 + contrastBoost * 0.075);
	const fg1 = mixHex(fg0, bg0, 0.14 + (1 - contrastBoost) * 0.03);
	const fg2 = mixHex(fg0, bg0, 0.34 + (1 - contrastBoost) * 0.08);
	const fg3 = mixHex(fg0, bg0, 0.54 + (1 - contrastBoost) * 0.08);
	const border = mixHex(bg0, fg0, 0.12 + contrastBoost * 0.1);
	const borderSoft = hexToRgba(fg0, 0.06 + contrastBoost * 0.08);
	const sidebarAlpha = settings.translucentSidebar ? 0.74 : 0.98;
	const root = document.documentElement;

	root.style.setProperty('--void-ui-font-family', resolveUiFontFamily(settings.uiFontPreset));
	root.style.setProperty('--void-code-font-family', resolveCodeFontFamily(settings.codeFontPreset));
	root.style.setProperty('--void-ui-font-size-px', `${settings.uiFontSize}px`);
	root.style.setProperty('--void-code-font-size-px', `${settings.codeFontSize}px`);
	root.style.setProperty('--void-bg-0', bg0);
	root.style.setProperty('--void-bg-1', bg1);
	root.style.setProperty('--void-bg-2', bg2);
	root.style.setProperty('--void-bg-3', bg3);
	root.style.setProperty('--void-fg-0', fg0);
	root.style.setProperty('--void-fg-1', fg1);
	root.style.setProperty('--void-fg-2', fg2);
	root.style.setProperty('--void-fg-3', fg3);
	root.style.setProperty('--void-accent', accent);
	root.style.setProperty('--void-accent-contrast', accentContrast(accent));
	root.style.setProperty('--void-accent-glow', hexToRgba(accent, 0.22 + contrastBoost * 0.08));
	root.style.setProperty('--void-accent-soft', hexToRgba(accent, 0.1 + contrastBoost * 0.04));
	root.style.setProperty('--void-border', border);
	root.style.setProperty('--void-border-soft', borderSoft);
	root.style.setProperty('--void-ring', accent);
	root.style.setProperty('--void-scrollbar-track', bg1);
	root.style.setProperty('--void-scrollbar-thumb', mixHex(bg0, fg0, 0.2 + contrastBoost * 0.1));
	root.style.setProperty('--void-scrollbar-thumb-hover', mixHex(bg0, fg0, 0.26 + contrastBoost * 0.1));
	root.style.setProperty('--void-scrollbar-thumb-active', mixHex(bg0, fg0, 0.32 + contrastBoost * 0.1));
	root.style.setProperty('--void-sidebar-fill', hexToRgba(bg1, sidebarAlpha));
	root.style.setProperty('--ref-menubar-chrome-bg', mixHex(bg0, fg0, 0.07 + contrastBoost * 0.04));
	root.setAttribute('data-ui-font', settings.uiFontPreset);
	root.setAttribute('data-code-font', settings.codeFontPreset);
	root.setAttribute('data-pointer-cursors', settings.usePointerCursors ? 'true' : 'false');
	root.setAttribute('data-translucent-sidebar', settings.translucentSidebar ? 'true' : 'false');
}
