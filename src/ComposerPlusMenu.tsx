import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { computeClampedPopoverLayout, POPOVER_VIEW_MARGIN, type ClampedPopoverLayout } from './anchorPopoverLayout';
import { useI18n } from './i18n';

export type ComposerMode = 'agent' | 'plan' | 'team' | 'debug' | 'ask';

const MODE_IDS: ComposerMode[] = ['agent', 'plan', 'team', 'debug', 'ask'];

/** 首帧估算高度（hint + 模式行 + 分隔 + 子项） */
const plusMenuEstHeight = () => MODE_IDS.length * 48 + 180;

function IconAgent({ className }: { className?: string }) {
	return (
		<svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
			<rect x="5" y="8" width="14" height="10" rx="2" />
			<path d="M9 8V6a3 3 0 0 1 6 0v2" strokeLinecap="round" />
			<circle cx="9.5" cy="13" r="1" fill="currentColor" stroke="none" />
			<circle cx="14.5" cy="13" r="1" fill="currentColor" stroke="none" />
		</svg>
	);
}

function IconPlan({ className }: { className?: string }) {
	return (
		<svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
			<path d="M8 6h13M8 12h13M8 18h13" strokeLinecap="round" />
			<circle cx="5" cy="6" r="1.5" fill="currentColor" stroke="none" />
			<circle cx="5" cy="12" r="1.5" fill="currentColor" stroke="none" />
			<circle cx="5" cy="18" r="1.5" fill="currentColor" stroke="none" />
		</svg>
	);
}

function IconDebug({ className }: { className?: string }) {
	return (
		<svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
			<path d="M12 4v2M8 6l-1 2M16 6l1 2M6 10h12M8 14l-1 4M16 14l1 4M9 20h6" strokeLinecap="round" strokeLinejoin="round" />
		</svg>
	);
}

function IconTeam({ className }: { className?: string }) {
	return (
		<svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
			<circle cx="7" cy="9" r="2" />
			<circle cx="12" cy="7" r="2" />
			<circle cx="17" cy="9" r="2" />
			<path d="M4 18a3 3 0 0 1 6 0M9 18a3 3 0 0 1 6 0M14 18a3 3 0 0 1 6 0" strokeLinecap="round" />
		</svg>
	);
}

function IconAsk({ className }: { className?: string }) {
	return (
		<svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
			<path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" strokeLinejoin="round" />
		</svg>
	);
}

function IconImage({ className }: { className?: string }) {
	return (
		<svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
			<rect x="3" y="5" width="18" height="14" rx="2" />
			<circle cx="8.5" cy="10" r="1.5" fill="currentColor" stroke="none" />
			<path d="M21 17l-5-5-4 4-2-2-4 4" strokeLinecap="round" strokeLinejoin="round" />
		</svg>
	);
}

function IconBook({ className }: { className?: string }) {
	return (
		<svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
			<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
			<path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
		</svg>
	);
}

function IconChip({ className }: { className?: string }) {
	return (
		<svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
			<rect x="4" y="4" width="16" height="16" rx="2" />
			<path d="M9 9h6M9 13h4" strokeLinecap="round" />
		</svg>
	);
}

function IconChevRight({ className }: { className?: string }) {
	return (
		<svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
			<path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
		</svg>
	);
}

function IconCheck({ className }: { className?: string }) {
	return (
		<svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
			<path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
		</svg>
	);
}

function modeIcon(id: ComposerMode) {
	switch (id) {
		case 'agent':
			return <IconAgent />;
		case 'plan':
			return <IconPlan />;
		case 'team':
			return <IconTeam />;
		case 'debug':
			return <IconDebug />;
		case 'ask':
			return <IconAsk />;
		default:
			return <IconAgent />;
	}
}

type Props = {
	open: boolean;
	onClose: () => void;
	anchorRef: React.RefObject<HTMLElement | null>;
	mode: ComposerMode;
	onSelectMode: (m: ComposerMode) => void;
};

export function ComposerPlusMenu({ open, onClose, anchorRef, mode, onSelectMode }: Props) {
	const { t } = useI18n();
	const modes = useMemo(
		() => MODE_IDS.map((id) => ({ id, label: t(`composer.mode.${id}`) })),
		[t]
	);
	const menuRef = useRef<HTMLDivElement>(null);
	const [layout, setLayout] = useState<ClampedPopoverLayout>({
		placement: 'below',
		left: 0,
		width: 280,
		top: 120,
		maxHeightPx: 380,
		minHeightPx: 160,
	});

	const runLayout = useCallback(() => {
		const el = anchorRef.current;
		if (!el) {
			return;
		}
		const menu = menuRef.current;
		const r = el.getBoundingClientRect();
		const vw = window.innerWidth;
		const vh = window.innerHeight;
		const w = Math.min(300, Math.max(260, vw - 2 * POPOVER_VIEW_MARGIN));
		const est = plusMenuEstHeight();
		const natural = menu && menu.scrollHeight > 48 ? Math.max(menu.scrollHeight, est) : est;
		setLayout(
			computeClampedPopoverLayout(r, {
				viewportWidth: vw,
				viewportHeight: vh,
				menuWidth: w,
				contentHeight: natural,
			})
		);
	}, [anchorRef]);

	useLayoutEffect(() => {
		if (!open) {
			return;
		}
		runLayout();
		const id0 = requestAnimationFrame(() => {
			runLayout();
			requestAnimationFrame(() => runLayout());
		});
		const menu = menuRef.current;
		const ro =
			menu && typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => runLayout()) : null;
		if (menu && ro) {
			ro.observe(menu);
		}
		const onWin = () => runLayout();
		window.addEventListener('resize', onWin);
		window.addEventListener('scroll', onWin, true);
		return () => {
			cancelAnimationFrame(id0);
			ro?.disconnect();
			window.removeEventListener('resize', onWin);
			window.removeEventListener('scroll', onWin, true);
		};
	}, [open, runLayout]);

	useEffect(() => {
		if (!open) {
			return;
		}
		const onDoc = (e: MouseEvent) => {
			const t = e.target as Node;
			if (menuRef.current?.contains(t) || anchorRef.current?.contains(t)) {
				return;
			}
			onClose();
		};
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				onClose();
			}
		};
		document.addEventListener('mousedown', onDoc);
		document.addEventListener('keydown', onKey);
		return () => {
			document.removeEventListener('mousedown', onDoc);
			document.removeEventListener('keydown', onKey);
		};
	}, [open, onClose, anchorRef]);

	if (!open) {
		return null;
	}

	return createPortal(
		<div
			ref={menuRef}
			className={`ref-plus-menu ${layout.placement === 'above' ? 'ref-plus-menu--above' : ''}`}
			style={{
				left: layout.left,
				width: layout.width,
				top: layout.placement === 'below' ? layout.top : undefined,
				bottom: layout.placement === 'above' ? layout.bottom : undefined,
				maxHeight: layout.maxHeightPx,
				minHeight: layout.minHeightPx,
				overflowY: 'auto',
			}}
			role="menu"
			aria-label={t('composer.plusMenuAria')}
		>
			<div className="ref-plus-menu-modes" role="group" aria-label={t('composer.plusMenuModes')}>
				{modes.map((m) => (
					<button
						key={m.id}
						type="button"
						role="menuitemradio"
						aria-checked={mode === m.id}
						className={`ref-plus-menu-row ref-plus-menu-row--mode ref-plus-menu-row--${m.id} ${mode === m.id ? 'is-active' : ''}`}
						onClick={() => {
							onSelectMode(m.id);
							onClose();
						}}
					>
						<span className="ref-plus-menu-ico">{modeIcon(m.id)}</span>
						<span className="ref-plus-menu-label">{m.label}</span>
						<span className="ref-plus-menu-check" aria-hidden>
							{mode === m.id ? <IconCheck /> : null}
						</span>
					</button>
				))}
			</div>
			<div className="ref-plus-menu-sep" role="separator" />
			<button type="button" className="ref-plus-menu-row ref-plus-menu-row--sub" role="menuitem" disabled title={t('common.soon')}>
				<span className="ref-plus-menu-ico">
					<IconImage />
				</span>
				<span className="ref-plus-menu-label">{t('composer.plusImage')}</span>
			</button>
			<button type="button" className="ref-plus-menu-row ref-plus-menu-row--sub" role="menuitem" disabled title={t('common.soon')}>
				<span className="ref-plus-menu-ico">
					<IconBook />
				</span>
				<span className="ref-plus-menu-label">{t('composer.plusSkills')}</span>
				<IconChevRight className="ref-plus-menu-chev" />
			</button>
			<button type="button" className="ref-plus-menu-row ref-plus-menu-row--sub" role="menuitem" disabled title={t('common.soon')}>
				<span className="ref-plus-menu-ico">
					<IconChip />
				</span>
				<span className="ref-plus-menu-label">{t('composer.plusMcp')}</span>
				<IconChevRight className="ref-plus-menu-chev" />
			</button>
		</div>,
		document.body
	);
}

export function composerModeLabel(id: ComposerMode, translate: (key: string) => string): string {
	return translate(`composer.mode.${id}`);
}

export function ComposerModeIcon({ mode, className }: { mode: ComposerMode; className?: string }) {
	return <span className={className}>{modeIcon(mode)}</span>;
}
