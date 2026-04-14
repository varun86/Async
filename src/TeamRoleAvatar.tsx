import type { ComponentType } from 'react';
import type { TeamRoleType } from './hooks/useTeamSession';
import {
	IconRoleLead,
	IconRoleFrontend,
	IconRoleBackend,
	IconRoleQa,
	IconRoleReviewer,
	IconRoleResearcher,
	IconRoleCustom,
} from './icons';

type IconProps = { className?: string };

const ROLE_ICON_MAP: Record<string, ComponentType<IconProps>> = {
	team_lead: IconRoleLead,
	frontend: IconRoleFrontend,
	backend: IconRoleBackend,
	qa: IconRoleQa,
	reviewer: IconRoleReviewer,
	researcher: IconRoleResearcher,
};

/**
 * Resolve the icon for a team role.
 * Checks assignmentKey first (for specific custom roles like "researcher"),
 * then falls back to roleType, then to the generic custom icon.
 */
function resolveIcon(roleType: TeamRoleType, assignmentKey?: string): ComponentType<IconProps> {
	if (assignmentKey && ROLE_ICON_MAP[assignmentKey]) {
		return ROLE_ICON_MAP[assignmentKey]!;
	}
	return ROLE_ICON_MAP[roleType] ?? IconRoleCustom;
}

/**
 * Resolve the CSS modifier class.
 * Custom roles with a known assignmentKey get their own color class.
 */
function resolveAvatarClass(roleType: TeamRoleType, assignmentKey?: string): string {
	if (roleType === 'custom' && assignmentKey && ROLE_ICON_MAP[assignmentKey]) {
		return assignmentKey;
	}
	return roleType;
}

type Props = {
	roleType: TeamRoleType;
	assignmentKey?: string;
	small?: boolean;
};

export function TeamRoleAvatar({ roleType, assignmentKey, small }: Props) {
	const Icon = resolveIcon(roleType, assignmentKey);
	const modifier = resolveAvatarClass(roleType, assignmentKey);
	const cls = [
		'ref-team-expert-avatar',
		`ref-team-expert-avatar--${modifier}`,
		small && 'ref-team-avatar-sm',
	].filter(Boolean).join(' ');
	return (
		<span className={cls}>
			<Icon />
		</span>
	);
}
