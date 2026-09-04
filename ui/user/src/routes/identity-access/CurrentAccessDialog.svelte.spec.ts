import type { AccessControlRule } from '$lib/services';
import type { HostedAgentAccessPolicy, ModelAccessPolicy, SkillAccessPolicy } from '$lib/services';
import { renderOpenDialog } from '../../tests/helpers/openDialog';
import { worker } from '../../tests/mocks/worker';
import CurrentAccessDialog from './CurrentAccessDialog.svelte';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

const userTarget = {
	kind: 'user' as const,
	id: 'user-1',
	name: 'Ada Lovelace',
	groupIds: ['engineering']
};

const groupTarget = {
	kind: 'group' as const,
	id: 'engineering',
	name: 'Engineering'
};

function mcpRule(
	overrides: Partial<AccessControlRule> & { id: string; displayName: string }
): AccessControlRule {
	return {
		created: '2026-01-01T00:00:00Z',
		subjects: [],
		resources: [],
		...overrides
	};
}

function modelPolicy(
	overrides: Partial<ModelAccessPolicy> & { id: string; displayName: string }
): ModelAccessPolicy {
	return {
		created: '2026-01-01T00:00:00Z',
		subjects: [],
		models: [],
		...overrides
	};
}

function skillPolicy(
	overrides: Partial<SkillAccessPolicy> & { id: string; displayName: string }
): SkillAccessPolicy {
	return {
		created: '2026-01-01T00:00:00Z',
		subjects: [],
		resources: [],
		...overrides
	};
}

function hostedPolicy(
	overrides: Partial<HostedAgentAccessPolicy> & { id: string; displayName: string }
): HostedAgentAccessPolicy {
	return {
		created: '2026-01-01T00:00:00Z',
		subjects: [],
		resources: [],
		...overrides
	};
}

function mockPolicies({
	mcp = [] as AccessControlRule[],
	workspaceMcp = [] as AccessControlRule[],
	models = [] as ModelAccessPolicy[],
	skills = [] as SkillAccessPolicy[],
	hosted = [] as HostedAgentAccessPolicy[]
} = {}) {
	worker.use(
		http.get('/api/mcp-catalogs/default/access-control-rules', () =>
			HttpResponse.json({ items: mcp })
		),
		http.get('/api/workspaces/all-access-control-rules', () =>
			HttpResponse.json({ items: workspaceMcp })
		),
		http.get('/api/model-access-policies', () => HttpResponse.json({ items: models })),
		http.get('/api/skill-access-rules', () => HttpResponse.json({ items: skills })),
		http.get('/api/hosted-agent-access-rules', () => HttpResponse.json({ items: hosted }))
	);
}

describe('CurrentAccessDialog.svelte', () => {
	it('lists policies that apply to the user, including everyone and group membership', async () => {
		mockPolicies({
			mcp: [
				mcpRule({
					id: 'mcp-user',
					displayName: 'Direct MCP',
					subjects: [{ type: 'user', id: 'user-1' }]
				}),
				mcpRule({
					id: 'mcp-other',
					displayName: 'Someone Else MCP',
					subjects: [{ type: 'user', id: 'user-2' }]
				})
			],
			workspaceMcp: [
				mcpRule({
					id: 'mcp-ws',
					displayName: 'Workspace MCP',
					powerUserWorkspaceID: 'ws-9',
					subjects: [{ type: 'group', id: 'engineering' }]
				})
			],
			models: [
				modelPolicy({
					id: 'model-everyone',
					displayName: 'Everyone Models',
					subjects: [{ type: 'selector', id: '*' }]
				})
			],
			skills: [
				skillPolicy({
					id: 'skill-sales',
					displayName: 'Sales Skills',
					subjects: [{ type: 'group', id: 'sales' }]
				}),
				skillPolicy({
					id: 'skill-user',
					displayName: 'Ada Skills',
					subjects: [{ type: 'user', id: 'user-1' }]
				})
			],
			hosted: [
				hostedPolicy({
					id: 'hosted-everyone',
					displayName: 'Everyone Hosted Agents',
					subjects: [{ type: 'selector', id: '*' }]
				})
			]
		});

		const dialog = await renderOpenDialog(CurrentAccessDialog, { target: userTarget });

		await expect
			.element(dialog.getByText('Current Access for Ada Lovelace', { exact: true }))
			.toBeVisible();
		await expect.element(dialog.getByText('Direct MCP', { exact: true })).toBeVisible();
		await expect.element(dialog.getByText('Workspace MCP', { exact: true })).toBeVisible();
		await expect.element(dialog.getByText('Everyone Models', { exact: true })).toBeVisible();
		await expect.element(dialog.getByText('Ada Skills', { exact: true })).toBeVisible();
		await expect.element(dialog.getByText('Everyone Hosted Agents', { exact: true })).toBeVisible();
		await expect
			.element(dialog.getByText('Someone Else MCP', { exact: true }))
			.not.toBeInTheDocument();
		await expect.element(dialog.getByText('Sales Skills', { exact: true })).not.toBeInTheDocument();

		await expect
			.element(dialog.getByRole('link', { name: /Workspace MCP/ }))
			.toHaveAttribute('href', '/mcp-servers/access-policies/w/ws-9/r/mcp-ws');
		await expect
			.element(dialog.getByRole('link', { name: /Everyone Models/ }))
			.toHaveAttribute('href', '/models/access-policies/model-everyone');
	});

	it('lists everyone and group-assigned policies for a group', async () => {
		mockPolicies({
			mcp: [
				mcpRule({
					id: 'mcp-everyone',
					displayName: 'Everyone MCP',
					subjects: [{ type: 'selector', id: '*' }]
				}),
				mcpRule({
					id: 'mcp-eng',
					displayName: 'Engineering MCP',
					subjects: [{ type: 'group', id: 'engineering' }]
				}),
				mcpRule({
					id: 'mcp-user',
					displayName: 'User Only MCP',
					subjects: [{ type: 'user', id: 'user-1' }]
				})
			]
		});

		const dialog = await renderOpenDialog(CurrentAccessDialog, { target: groupTarget });

		await expect
			.element(dialog.getByText('Current Access for Engineering', { exact: true }))
			.toBeVisible();
		await expect.element(dialog.getByText('Everyone MCP', { exact: true })).toBeVisible();
		await expect.element(dialog.getByText('Engineering MCP', { exact: true })).toBeVisible();
		await expect
			.element(dialog.getByText('User Only MCP', { exact: true }))
			.not.toBeInTheDocument();
	});

	it('shows an empty state when no policies apply', async () => {
		mockPolicies();

		const dialog = await renderOpenDialog(CurrentAccessDialog, { target: userTarget });

		await expect
			.element(
				dialog.getByText('No access policies currently apply to this user.', { exact: true })
			)
			.toBeVisible();
	});
});
