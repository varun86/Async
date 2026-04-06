import { useState, type Dispatch, type SetStateAction } from 'react';
import type { ComposerSegment, SlashCommandId } from '../composerSegments';

/** `/create-skill` | `/create-rule` | `/create-subagent` 发送前向导状态 */
export type WizardPending = {
	kind: SlashCommandId;
	tailSegments: ComposerSegment[];
	targetThreadId: string;
};

export type WizardPendingState = WizardPending | null;

export function useWizardPending(): {
	wizardPending: WizardPendingState;
	setWizardPending: Dispatch<SetStateAction<WizardPendingState>>;
} {
	const [wizardPending, setWizardPending] = useState<WizardPendingState>(null);
	return { wizardPending, setWizardPending };
}
