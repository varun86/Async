import { useMemo, useState, type ReactNode } from 'react';
import type { AppColorMode, ThemeTransitionOrigin } from './colorMode';
import {
	APPLE_UI_FONT_STACK,
	APPEARANCE_THEME_PRESETS,
	JETBRAINS_CODE_FONT_STACK,
	MONOSPACE_CODE_FONT_STACK,
	SFMONO_CODE_FONT_STACK,
	applyThemePreset,
	type AppAppearanceSettings,
	type CodeFontPresetId,
	type ThemePresetId,
	type UiFontPresetId,
} from './appearanceSettings';
import { useI18n } from './i18n';
import { VoidSelect } from './VoidSelect';

function IconSun({ className }: { className?: string }) {
	return (
		<svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
			<circle cx="12" cy="12" r="4" />
			<path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" strokeLinecap="round" />
		</svg>
	);
}

function IconMoon({ className }: { className?: string }) {
	return (
		<svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
			<path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" strokeLinecap="round" strokeLinejoin="round" />
		</svg>
	);
}

function IconMonitor({ className }: { className?: string }) {
	return (
		<svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
			<rect x="2" y="3" width="20" height="14" rx="2" />
			<path d="M8 21h8M12 17v4" strokeLinecap="round" />
		</svg>
	);
}

function IconPalette({ className }: { className?: string }) {
	return (
		<svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
			<path d="M12 3a9 9 0 1 0 0 18h1.2a2.8 2.8 0 1 0 0-5.6H12a2 2 0 0 1 0-4h1a4 4 0 0 0 0-8h-1Z" strokeLinecap="round" strokeLinejoin="round" />
			<circle cx="6.5" cy="11.5" r="1" fill="currentColor" stroke="none" />
			<circle cx="8.5" cy="7.5" r="1" fill="currentColor" stroke="none" />
			<circle cx="12.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
		</svg>
	);
}

function IconImport({ className }: { className?: string }) {
	return (
		<svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
			<path d="M12 3v12M7 10l5 5 5-5M5 21h14" strokeLinecap="round" strokeLinejoin="round" />
		</svg>
	);
}

function IconCopy({ className }: { className?: string }) {
	return (
		<svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
			<rect x="9" y="9" width="11" height="11" rx="2" />
			<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" strokeLinecap="round" strokeLinejoin="round" />
		</svg>
	);
}

type Props = {
	value: AppColorMode;
	onChange: (next: AppColorMode, origin?: ThemeTransitionOrigin) => void | Promise<void>;
	appearance: AppAppearanceSettings;
	onChangeAppearance: (next: AppAppearanceSettings) => void | Promise<void>;
};

function ThemeField({
	label,
	description,
	children,
}: {
	label: string;
	description?: string;
	children: ReactNode;
}) {
	return (
		<div className="ref-appearance-theme-row">
			<div className="ref-appearance-theme-row-copy">
				<div className="ref-appearance-theme-row-label">{label}</div>
				{description ? <p className="ref-appearance-theme-row-desc">{description}</p> : null}
			</div>
			<div className="ref-appearance-theme-row-control">{children}</div>
		</div>
	);
}

function clamp(n: number, min: number, max: number) {
	return Math.min(Math.max(n, min), max);
}

function normalizeHexInput(value: string, fallback: string): string {
	const s = value.trim();
	if (/^#[0-9a-fA-F]{6}$/.test(s)) {
		return s.toUpperCase();
	}
	if (/^#[0-9a-fA-F]{3}$/.test(s)) {
		return (`#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`).toUpperCase();
	}
	return fallback;
}

export function SettingsAppearancePanel({ value, onChange, appearance, onChangeAppearance }: Props) {
	const { t } = useI18n();
	const [presetChoice, setPresetChoice] = useState<ThemePresetId>('codex');
	const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle');
	const modes: { id: AppColorMode; label: string; icon: ReactNode }[] = [
		{ id: 'light', label: t('settings.appearance.light'), icon: <IconSun className="ref-appearance-seg-ico" /> },
		{ id: 'dark', label: t('settings.appearance.dark'), icon: <IconMoon className="ref-appearance-seg-ico" /> },
		{ id: 'system', label: t('settings.appearance.system'), icon: <IconMonitor className="ref-appearance-seg-ico" /> },
	];
	const uiFonts: { id: UiFontPresetId; label: string; stack: string }[] = [
		{ id: 'apple', label: t('settings.appearance.font.apple'), stack: APPLE_UI_FONT_STACK },
		{ id: 'inter', label: t('settings.appearance.font.inter'), stack: 'Inter, system-ui, sans-serif' },
		{ id: 'segoe', label: t('settings.appearance.font.segoe'), stack: 'Segoe UI, system-ui, sans-serif' },
	];
	const codeFonts: { id: CodeFontPresetId; label: string; stack: string }[] = [
		{ id: 'sfmono', label: t('settings.appearance.codeFont.sfmono'), stack: SFMONO_CODE_FONT_STACK },
		{ id: 'monospace', label: t('settings.appearance.codeFont.monospace'), stack: MONOSPACE_CODE_FONT_STACK },
		{ id: 'jetbrains', label: t('settings.appearance.codeFont.jetbrains'), stack: JETBRAINS_CODE_FONT_STACK },
	];
	const previewTheme = useMemo(() => APPEARANCE_THEME_PRESETS[presetChoice], [presetChoice]);

	const patch = (partial: Partial<AppAppearanceSettings>, options?: { markCustom?: boolean }) => {
		void onChangeAppearance({
			...appearance,
			...partial,
			themePreset: options?.markCustom === false ? appearance.themePreset : 'custom',
		});
	};

	const handleColorChange = (key: 'accentColor' | 'backgroundColor' | 'foregroundColor', next: string) => {
		patch({ [key]: normalizeHexInput(next, appearance[key]) } as Partial<AppAppearanceSettings>);
	};

	const handleImportPreset = () => {
		void onChangeAppearance(applyThemePreset(appearance, presetChoice));
	};

	const handleCopyTheme = async () => {
		const payload = {
			themePreset: appearance.themePreset,
			accentColor: appearance.accentColor,
			backgroundColor: appearance.backgroundColor,
			foregroundColor: appearance.foregroundColor,
			uiFontPreset: appearance.uiFontPreset,
			codeFontPreset: appearance.codeFontPreset,
			translucentSidebar: appearance.translucentSidebar,
			contrast: appearance.contrast,
			usePointerCursors: appearance.usePointerCursors,
			uiFontSize: appearance.uiFontSize,
			codeFontSize: appearance.codeFontSize,
		};
		try {
			await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
			setCopyState('copied');
			window.setTimeout(() => setCopyState('idle'), 1400);
		} catch {
			setCopyState('idle');
		}
	};

	return (
		<div className="ref-settings-panel ref-settings-panel--appearance">
			<p className="ref-appearance-lead">{t('settings.appearance.lead')}</p>

			<section className="ref-settings-agent-section" aria-labelledby="appearance-theme-heading">
				<h2 id="appearance-theme-heading" className="ref-settings-agent-section-title">
					{t('settings.appearance.themeTitle')}
				</h2>
				<p className="ref-settings-agent-section-desc">{t('settings.appearance.themeDesc')}</p>
				<div className="ref-appearance-shell-card">
					<div className="ref-appearance-shell-card-top">
						<div className="ref-appearance-seg" role="group" aria-label={t('settings.appearance.ariaGroup')}>
							{modes.map((m) => (
								<button
									key={m.id}
									type="button"
									className={`ref-appearance-seg-btn${value === m.id ? ' is-active' : ''}`}
									onClick={(event) => void onChange(m.id, { x: event.clientX, y: event.clientY })}
									aria-pressed={value === m.id}
								>
									{m.icon}
									{m.label}
								</button>
							))}
						</div>
					</div>

					<div className="ref-appearance-code-preview" aria-hidden>
						<div className="ref-appearance-code-pane ref-appearance-code-pane--before">
							<div className="ref-appearance-code-gutter">
								<span>1</span>
								<span className="is-hot">2</span>
								<span className="is-hot">3</span>
								<span>4</span>
							</div>
							<div className="ref-appearance-code-content">
								<div><span className="token-key">surface</span>: <span className="token-string">"sidebar"</span>,</div>
								<div><span className="token-key">accent</span>: <span className="token-string">"{previewTheme.accentColor}"</span>,</div>
								<div><span className="token-key">contrast</span>: <span className="token-number">{previewTheme.contrast}</span></div>
							</div>
						</div>
						<div className="ref-appearance-code-pane ref-appearance-code-pane--after" style={{ borderColor: appearance.accentColor }}>
							<div className="ref-appearance-code-gutter">
								<span>1</span>
								<span className="is-cool">2</span>
								<span className="is-cool">3</span>
								<span>4</span>
							</div>
							<div className="ref-appearance-code-content">
								<div><span className="token-key">surface</span>: <span className="token-string">"sidebar-elevated"</span>,</div>
								<div><span className="token-key">accent</span>: <span className="token-string">"{appearance.accentColor}"</span>,</div>
								<div><span className="token-key">contrast</span>: <span className="token-number">{appearance.contrast}</span></div>
							</div>
						</div>
					</div>

					<div className="ref-appearance-theme-editor">
						<div className="ref-appearance-theme-editor-head">
							<div>
								<h3 className="ref-appearance-theme-editor-title">{t('settings.appearance.themeEditorTitle')}</h3>
								<p className="ref-appearance-theme-editor-desc">{t('settings.appearance.themeEditorDesc')}</p>
							</div>
							<div className="ref-appearance-theme-editor-actions">
								<button type="button" className="ref-appearance-toolbar-btn" onClick={handleImportPreset}>
									<IconImport />
									{t('settings.appearance.importTheme')}
								</button>
								<button type="button" className="ref-appearance-toolbar-btn" onClick={() => void handleCopyTheme()}>
									<IconCopy />
									{copyState === 'copied' ? t('settings.appearance.copiedTheme') : t('settings.appearance.copyTheme')}
								</button>
								<div className="ref-appearance-preset-wrap">
									<span className="ref-appearance-preset-icon"><IconPalette /></span>
									<VoidSelect
										ariaLabel={t('settings.appearance.themePreset')}
										value={presetChoice}
										onChange={(next) => setPresetChoice(next as ThemePresetId)}
										options={[
											{ value: 'codex', label: t('settings.appearance.preset.codex') },
											{ value: 'graphite', label: t('settings.appearance.preset.graphite') },
											{ value: 'midnight', label: t('settings.appearance.preset.midnight') },
										]}
										variant="compact"
									/>
								</div>
							</div>
						</div>

						<ThemeField label={t('settings.appearance.accent')}>
							<div className="ref-appearance-color-control">
								<input type="color" value={appearance.accentColor} onChange={(e) => handleColorChange('accentColor', e.target.value)} />
								<input type="text" value={appearance.accentColor} onChange={(e) => handleColorChange('accentColor', e.target.value)} />
							</div>
						</ThemeField>
						<ThemeField label={t('settings.appearance.background')}>
							<div className="ref-appearance-color-control">
								<input type="color" value={appearance.backgroundColor} onChange={(e) => handleColorChange('backgroundColor', e.target.value)} />
								<input type="text" value={appearance.backgroundColor} onChange={(e) => handleColorChange('backgroundColor', e.target.value)} />
							</div>
						</ThemeField>
						<ThemeField label={t('settings.appearance.foreground')}>
							<div className="ref-appearance-color-control">
								<input type="color" value={appearance.foregroundColor} onChange={(e) => handleColorChange('foregroundColor', e.target.value)} />
								<input type="text" value={appearance.foregroundColor} onChange={(e) => handleColorChange('foregroundColor', e.target.value)} />
							</div>
						</ThemeField>
						<ThemeField label={t('settings.appearance.fontTitle')}>
							<div className="ref-appearance-select-stack">
								<VoidSelect
									ariaLabel={t('settings.appearance.fontTitle')}
									value={appearance.uiFontPreset}
									onChange={(next) => patch({ uiFontPreset: next as UiFontPresetId })}
									options={uiFonts.map((font) => ({ value: font.id, label: font.label }))}
									variant="compact"
								/>
								<span className="ref-appearance-inline-code">{uiFonts.find((item) => item.id === appearance.uiFontPreset)?.stack}</span>
							</div>
						</ThemeField>
						<ThemeField label={t('settings.appearance.codeFontTitle')}>
							<div className="ref-appearance-select-stack">
								<VoidSelect
									ariaLabel={t('settings.appearance.codeFontTitle')}
									value={appearance.codeFontPreset}
									onChange={(next) => patch({ codeFontPreset: next as CodeFontPresetId })}
									options={codeFonts.map((font) => ({ value: font.id, label: font.label }))}
									variant="compact"
								/>
								<span className="ref-appearance-inline-code">{codeFonts.find((item) => item.id === appearance.codeFontPreset)?.stack}</span>
							</div>
						</ThemeField>
						<ThemeField label={t('settings.appearance.translucentSidebar')}>
							<button
								type="button"
								className={`ref-settings-toggle ${appearance.translucentSidebar ? 'is-on' : ''}`}
								role="switch"
								aria-checked={appearance.translucentSidebar}
								onClick={() => patch({ translucentSidebar: !appearance.translucentSidebar })}
							>
								<span className="ref-settings-toggle-knob" />
							</button>
						</ThemeField>
						<ThemeField label={t('settings.appearance.contrast')}>
							<div className="ref-appearance-range-wrap">
								<input
									type="range"
									min={0}
									max={100}
									value={appearance.contrast}
									onChange={(e) => patch({ contrast: clamp(Number(e.target.value), 0, 100) })}
								/>
								<span>{appearance.contrast}</span>
							</div>
						</ThemeField>
					</div>
				</div>
			</section>

			<section className="ref-settings-agent-section" aria-labelledby="appearance-pointer-heading">
				<div className="ref-appearance-subcard">
					<ThemeField
						label={t('settings.appearance.pointerCursorTitle')}
						description={t('settings.appearance.pointerCursorDesc')}
					>
						<button
							type="button"
							className={`ref-settings-toggle ${appearance.usePointerCursors ? 'is-on' : ''}`}
							role="switch"
							aria-checked={appearance.usePointerCursors}
							onClick={() => patch({ usePointerCursors: !appearance.usePointerCursors })}
						>
							<span className="ref-settings-toggle-knob" />
						</button>
					</ThemeField>
				</div>
			</section>

			<section className="ref-settings-agent-section" aria-labelledby="appearance-size-heading">
				<div className="ref-appearance-subcard">
					<ThemeField
						label={t('settings.appearance.uiFontSize')}
						description={t('settings.appearance.uiFontSizeDesc')}
					>
						<div className="ref-appearance-number-control">
							<input
								type="number"
								min={11}
								max={18}
								value={appearance.uiFontSize}
								onChange={(e) => patch({ uiFontSize: clamp(Number(e.target.value) || appearance.uiFontSize, 11, 18) })}
							/>
							<span>px</span>
						</div>
					</ThemeField>
					<ThemeField
						label={t('settings.appearance.codeFontSize')}
						description={t('settings.appearance.codeFontSizeDesc')}
					>
						<div className="ref-appearance-number-control">
							<input
								type="number"
								min={11}
								max={18}
								value={appearance.codeFontSize}
								onChange={(e) => patch({ codeFontSize: clamp(Number(e.target.value) || appearance.codeFontSize, 11, 18) })}
							/>
							<span>px</span>
						</div>
					</ThemeField>
				</div>
			</section>
		</div>
	);
}
