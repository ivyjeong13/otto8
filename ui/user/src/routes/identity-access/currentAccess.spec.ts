import { AdminService } from '$lib/services';
import {
	hasAnyCurrentAccess,
	loadCurrentAccess,
	mcpAccessPolicyHref,
	subjectsApplyTo,
	type CurrentAccessTarget
} from './currentAccess';
import { afterEach, describe, expect, it, vi } from 'vitest';

const userTarget: CurrentAccessTarget = {
	kind: 'user',
	id: 'user-1',
	name: 'Ada',
	groupIds: ['engineering']
};

const groupTarget: CurrentAccessTarget = {
	kind: 'group',
	id: 'engineering',
	name: 'Engineering'
};

afterEach(() => {
	vi.restoreAllMocks();
});

describe('subjectsApplyTo', () => {
	it('matches everyone, the user, and groups the user belongs to', () => {
		expect(subjectsApplyTo([{ type: 'selector', id: '*' }], userTarget)).toEqual(['everyone']);
		expect(subjectsApplyTo([{ type: 'user', id: 'user-1' }], userTarget)).toEqual(['direct-user']);
		expect(subjectsApplyTo([{ type: 'group', id: 'engineering' }], userTarget)).toEqual([
			'via-group'
		]);
		expect(subjectsApplyTo([{ type: 'user', id: 'other' }], userTarget)).toEqual([]);
		expect(subjectsApplyTo([{ type: 'group', id: 'sales' }], userTarget)).toEqual([]);
	});

	it('matches everyone and the group itself for a group target', () => {
		expect(subjectsApplyTo([{ type: 'selector', id: '*' }], groupTarget)).toEqual(['everyone']);
		expect(subjectsApplyTo([{ type: 'group', id: 'engineering' }], groupTarget)).toEqual([
			'direct-group'
		]);
		expect(subjectsApplyTo([{ type: 'user', id: 'user-1' }], groupTarget)).toEqual([]);
		expect(subjectsApplyTo([{ type: 'group', id: 'sales' }], groupTarget)).toEqual([]);
	});
});

describe('mcpAccessPolicyHref', () => {
	it('uses the workspace path for power-user workspace rules', () => {
		expect(
			mcpAccessPolicyHref({
				id: 'rule-1',
				displayName: 'Workspace',
				created: '2026-01-01T00:00:00Z',
				powerUserWorkspaceID: 'ws-1'
			})
		).toBe('/mcp-servers/access-policies/w/ws-1/r/rule-1');
	});
});

describe('loadCurrentAccess', () => {
	it('filters each policy type and includes everyone', async () => {
		vi.spyOn(AdminService, 'listAccessControlRules').mockResolvedValue([
			{
				id: 'mcp-user',
				displayName: 'User MCP',
				created: '2026-01-01T00:00:00Z',
				subjects: [{ type: 'user', id: 'user-1' }]
			},
			{
				id: 'mcp-other',
				displayName: 'Other MCP',
				created: '2026-01-01T00:00:00Z',
				subjects: [{ type: 'user', id: 'other' }]
			}
		]);
		vi.spyOn(AdminService, 'listAllUserWorkspaceAccessControlRules').mockResolvedValue([
			{
				id: 'mcp-ws',
				displayName: 'Workspace MCP',
				created: '2026-01-01T00:00:00Z',
				powerUserWorkspaceID: 'ws-1',
				subjects: [{ type: 'group', id: 'engineering' }]
			}
		]);
		vi.spyOn(AdminService, 'listModelAccessPolicies').mockResolvedValue([
			{
				id: 'model-everyone',
				displayName: 'Everyone Models',
				created: '2026-01-01T00:00:00Z',
				subjects: [{ type: 'selector', id: '*' }]
			}
		]);
		vi.spyOn(AdminService, 'listSkillAccessPolicies').mockResolvedValue([
			{
				id: 'skill-sales',
				displayName: 'Sales Skills',
				created: '2026-01-01T00:00:00Z',
				subjects: [{ type: 'group', id: 'sales' }],
				resources: []
			}
		]);
		vi.spyOn(AdminService, 'listHostedAgentAccessPolicies').mockResolvedValue([
			{
				id: 'hosted-user',
				displayName: 'User Hosted',
				created: '2026-01-01T00:00:00Z',
				subjects: [{ type: 'user', id: 'user-1' }],
				resources: []
			}
		]);

		const sections = await loadCurrentAccess(userTarget);

		expect(sections.mcp.map((policy) => policy.id)).toEqual(['mcp-user', 'mcp-ws']);
		expect(sections.mcp[1]?.href).toBe('/mcp-servers/access-policies/w/ws-1/r/mcp-ws');
		expect(sections.models.map((policy) => policy.displayName)).toEqual(['Everyone Models']);
		expect(sections.skills).toEqual([]);
		expect(sections.hostedAgents.map((policy) => policy.id)).toEqual(['hosted-user']);
		expect(hasAnyCurrentAccess(sections)).toBe(true);
	});
});
