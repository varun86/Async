import { useCallback, useLayoutEffect, useMemo, useRef } from 'react';
import {
	isSlashCommandDomPendingUpgrade,
	segmentsContentKey,
	segmentsToWireText,
	type ComposerSegment,
} from './composerSegments';
import {
	type FileChipDomHandlers,
	placeCaretAtEndOfRichRoot,
	readSegmentsFromRoot,
	writeSegmentsToRoot,
} from './composerRichDom';

type Props = {
	segments: ComposerSegment[];
	onSegmentsChange: (next: ComposerSegment[]) => void;
	className?: string;
	placeholder?: string;
	/** 点击文件 chip：打开侧栏预览 */
	onFilePreview: (relPath: string) => void;
	/** 与 useComposerAtMention 联动 */
	onRichInput: (root: HTMLElement) => void;
	onRichSelect: (root: HTMLElement) => void;
	onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void;
	onInputHeight?: (el: HTMLDivElement) => void;
	innerRef: React.RefObject<HTMLDivElement | null>;
};

export function ComposerRichInput({
	segments,
	onSegmentsChange,
	className,
	placeholder,
	onFilePreview,
	onRichInput,
	onRichSelect,
	onKeyDown,
	onInputHeight,
	innerRef,
}: Props) {
	const focusedRef = useRef(false);
	const lastEmittedRef = useRef<string>('');

	const emitFromDom = useCallback(() => {
		const el = innerRef.current;
		if (!el) {
			return;
		}
		const next = readSegmentsFromRoot(el);
		lastEmittedRef.current = segmentsToWireText(next);
		onSegmentsChange(next);
	}, [innerRef, onSegmentsChange]);

	const domHandlers = useMemo<FileChipDomHandlers>(
		() => ({
			onPreview: onFilePreview,
			onStructureChange: () => {
				const el = innerRef.current;
				if (!el) {
					return;
				}
				const next = readSegmentsFromRoot(el);
				lastEmittedRef.current = segmentsToWireText(next);
				onSegmentsChange(next);
			},
		}),
		[innerRef, onFilePreview, onSegmentsChange]
	);

	useLayoutEffect(() => {
		const el = innerRef.current;
		if (!el) {
			return;
		}
		const wire = segmentsToWireText(segments);
		if (wire === '') {
			if (el.innerHTML !== '') {
				el.innerHTML = '';
			}
			lastEmittedRef.current = '';
			return;
		}
		const domSegs = readSegmentsFromRoot(el);
		const propKey = segmentsContentKey(segments);
		const domKey = segmentsContentKey(domSegs);
		if (propKey === domKey) {
			lastEmittedRef.current = wire;
			return;
		}
		const domWire = segmentsToWireText(domSegs);
		if (focusedRef.current) {
			// 菜单回车时往往只打了「/」或半段命令：props 已扩展为完整命令/chip，DOM 仍是前缀，须允许写入
			const allowSyncWhileFocused =
				domWire === wire ||
				isSlashCommandDomPendingUpgrade(segments, domSegs) ||
				(wire.length > domWire.length && wire.startsWith(domWire));
			if (!allowSyncWhileFocused) {
				return;
			}
			writeSegmentsToRoot(el, segments, domHandlers);
			lastEmittedRef.current = wire;
			placeCaretAtEndOfRichRoot(el);
			return;
		}
		writeSegmentsToRoot(el, segments, domHandlers);
		lastEmittedRef.current = wire;
	}, [segments, innerRef, domHandlers]);

	const handleInput = () => {
		emitFromDom();
		const el = innerRef.current;
		if (el) {
			onRichInput(el);
		}
		if (el && onInputHeight) {
			onInputHeight(el);
		}
	};

	return (
		<div className="ref-composer-rich-wrap">
			<div
				ref={innerRef as React.Ref<HTMLDivElement>}
				className={['ref-composer-rich-input', className].filter(Boolean).join(' ')}
				contentEditable
				suppressContentEditableWarning
				role="textbox"
				aria-multiline="true"
				data-placeholder={placeholder || ''}
				onFocus={() => {
					focusedRef.current = true;
				}}
				onBlur={() => {
					focusedRef.current = false;
				}}
				onInput={handleInput}
				onSelect={() => {
					const el = innerRef.current;
					if (el) {
						onRichSelect(el);
					}
				}}
				onKeyUp={(e) => {
					const el = innerRef.current;
					if (el) {
						onRichInput(el);
					}
					if (e.key === 'Enter' || e.key === 'Backspace' || e.key === 'Delete') {
						const ed = innerRef.current;
						if (ed && onInputHeight) {
							onInputHeight(ed);
						}
					}
				}}
				onMouseUp={() => {
					const el = innerRef.current;
					if (el) {
						onRichSelect(el);
					}
				}}
				onKeyDown={onKeyDown}
			/>
		</div>
	);
}
