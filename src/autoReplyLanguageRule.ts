import type { AppLocale } from './i18n';

export const AUTO_REPLY_LANGUAGE_RULE_ID = '__auto-reply-language__';

function normalizeLocale(raw: string | null | undefined): string {
	const value = String(raw ?? '').trim();
	if (!value) {
		return 'en';
	}
	try {
		return new Intl.Locale(value).toString();
	} catch {
		return value;
	}
}

function languageLabelForUi(locale: string, uiLocale: AppLocale): string {
	const normalized = normalizeLocale(locale).toLowerCase();
	if (normalized === 'zh-cn' || normalized.startsWith('zh-hans')) {
		return uiLocale === 'en' ? 'Simplified Chinese' : '简体中文';
	}
	if (normalized.startsWith('en')) {
		return uiLocale === 'en' ? 'English' : '英文';
	}
	try {
		const display = new Intl.DisplayNames([uiLocale], { type: 'language' });
		const base = normalized.split('-')[0] || normalized;
		return display.of(base) ?? normalizeLocale(locale);
	} catch {
		return normalizeLocale(locale);
	}
}

function buildRuleName(locale: string, uiLocale: AppLocale): string {
	const label = languageLabelForUi(locale, uiLocale);
	return uiLocale === 'en'
		? `Automatic language: Reply in ${label}`
		: `自动语言：默认使用${label}回复`;
}

function buildRuleContent(locale: string, uiLocale: AppLocale): string {
	const label = languageLabelForUi(locale, uiLocale);
	return uiLocale === 'en'
		? `Always reply in ${label} by default. If the user explicitly asks for another language, follow that request.`
		: `默认始终使用${label}回复。只有当用户明确要求使用其他语言时，才切换到该语言。`;
}

export function createAutoReplyLanguageRule(locale: string, uiLocale: AppLocale): {
	id: string;
	name: string;
	content: string;
	scope: 'always';
	enabled: true;
} {
	return {
		id: AUTO_REPLY_LANGUAGE_RULE_ID,
		name: buildRuleName(locale, uiLocale),
		content: buildRuleContent(locale, uiLocale),
		scope: 'always',
		enabled: true,
	};
}

export function buildAutoReplyLanguageRuleBlock(locale: string, uiLocale: AppLocale): string {
	const rule = createAutoReplyLanguageRule(locale, uiLocale);
	return `#### Rule: ${rule.name}\n${rule.content}`;
}
