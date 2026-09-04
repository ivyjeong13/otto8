import { AdminService, type AccessControlRule, type AccessControlRuleSubject } from '$lib/services';

export type CurrentAccessKind = 'user' | 'group';

export type AccessMatchReason = 'everyone' | 'direct-user' | 'direct-group' | 'via-group';

export interface CurrentAccessTarget {
	kind: CurrentAccessKind;
	id: string;
	name: string;
	groupIds?: string[];
}

export interface MatchedAccessPolicy {
	id: string;
	displayName: string;
	href: `/${string}`;
	reasons: AccessMatchReason[];
}

export interface CurrentAccessSections {
	mcp: MatchedAccessPolicy[];
	models: MatchedAccessPolicy[];
	skills: MatchedAccessPolicy[];
	hostedAgents: MatchedAccessPolicy[];
}

export const ACCESS_MATCH_REASON_LABEL: Record<AccessMatchReason, string> = {
	everyone: 'All Obot Users',
	'direct-user': 'Assigned to this user',
	'direct-group': 'Assigned to this group',
	'via-group': 'Via group membership'
};

export function isEveryoneSubject(subject: AccessControlRuleSubject): boolean {
	return subject.id === '*';
}

export function subjectsApplyTo(
	subjects: AccessControlRuleSubject[] | undefined,
	target: CurrentAccessTarget
): AccessMatchReason[] {
	if (!subjects?.length) {
		return [];
	}

	const reasons = new Set<AccessMatchReason>();
	const groupIds = new Set(target.groupIds ?? []);
	if (target.kind === 'group') {
		groupIds.add(target.id);
	}

	for (const subject of subjects) {
		if (isEveryoneSubject(subject)) {
			reasons.add('everyone');
			continue;
		}

		if (target.kind === 'user' && subject.type === 'user' && subject.id === target.id) {
			reasons.add('direct-user');
			continue;
		}

		if (subject.type === 'group' && groupIds.has(subject.id)) {
			reasons.add(target.kind === 'group' ? 'direct-group' : 'via-group');
		}
	}

	return [...reasons];
}

export function mcpAccessPolicyHref(rule: AccessControlRule): `/${string}` {
	if (rule.powerUserWorkspaceID) {
		return `/mcp-servers/access-policies/w/${rule.powerUserWorkspaceID}/r/${rule.id}`;
	}
	return `/mcp-servers/access-policies/${rule.id}`;
}

function settledItems<T>(result: PromiseSettledResult<T[]>): T[] {
	return result.status === 'fulfilled' ? result.value : [];
}

function matchPolicies<
	T extends { id: string; displayName: string; subjects?: AccessControlRuleSubject[] }
>(
	policies: T[],
	target: CurrentAccessTarget,
	href: (policy: T) => `/${string}`
): MatchedAccessPolicy[] {
	return policies
		.flatMap((policy) => {
			const reasons = subjectsApplyTo(policy.subjects, target);
			if (reasons.length === 0) {
				return [];
			}
			return [
				{
					id: policy.id,
					displayName: policy.displayName,
					href: href(policy),
					reasons
				}
			];
		})
		.sort((a, b) => a.displayName.localeCompare(b.displayName));
}

function dedupeById<T extends { id: string }>(items: T[]): T[] {
	const seen = new Set<string>();
	return items.filter((item) => {
		if (seen.has(item.id)) {
			return false;
		}
		seen.add(item.id);
		return true;
	});
}

export async function loadCurrentAccess(
	target: CurrentAccessTarget
): Promise<CurrentAccessSections> {
	const [mcpCatalog, mcpWorkspaces, models, skills, hostedAgents] = await Promise.allSettled([
		AdminService.listAccessControlRules(),
		AdminService.listAllUserWorkspaceAccessControlRules(),
		AdminService.listModelAccessPolicies(),
		AdminService.listSkillAccessPolicies(),
		AdminService.listHostedAgentAccessPolicies()
	]);

	return {
		mcp: matchPolicies(
			dedupeById([...settledItems(mcpCatalog), ...settledItems(mcpWorkspaces)]),
			target,
			mcpAccessPolicyHref
		),
		models: matchPolicies(
			settledItems(models),
			target,
			(policy) => `/models/access-policies/${policy.id}`
		),
		skills: matchPolicies(
			settledItems(skills),
			target,
			(policy) => `/skills/access-policies/${policy.id}`
		),
		hostedAgents: matchPolicies(
			settledItems(hostedAgents),
			target,
			(policy) => `/hosted-agents/access-policies/${policy.id}`
		)
	};
}

export function hasAnyCurrentAccess(sections: CurrentAccessSections): boolean {
	return (
		sections.mcp.length > 0 ||
		sections.models.length > 0 ||
		sections.skills.length > 0 ||
		sections.hostedAgents.length > 0
	);
}
