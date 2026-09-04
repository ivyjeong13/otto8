import type { VMcpToolFlow } from '$lib/runes/vmcps/vmcpToolFlow.svelte';
import { createMCPCatalogEntry } from '../../../tests/helpers/mcp';
import VMcpProfiles from './VMcpProfiles.svelte';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';

function createVMcp(id: string, withPreview = true) {
	return createMCPCatalogEntry({
		id,
		name: 'Engineering vMCP',
		runtime: 'composite',
		manifest: {
			compositeConfig: {
				componentServers: [
					{
						catalogEntryID: 'github',
						manifest: {
							name: 'GitHub',
							runtime: 'remote',
							serverUserType: 'singleUser',
							toolPreview: withPreview
								? [
										{ id: 'issues', name: 'list_issues', description: 'List issues' },
										{ id: 'pulls', name: 'list_pulls', description: 'List pull requests' }
									]
								: []
						}
					}
				]
			}
		}
	});
}

function toolFlowStub(overrides: Partial<VMcpToolFlow> = {}): VMcpToolFlow {
	return {
		collectComponentTools: vi.fn(),
		...overrides
	} as VMcpToolFlow;
}

async function expandServerTools() {
	await page.getByRole('button', { name: 'Expand' }).click();
}

describe('VMcpProfiles.svelte', () => {
	it('creates a profile with per-server tool selection', async () => {
		render(VMcpProfiles, { vmcp: createVMcp('vmcp-create-profile'), toolFlow: toolFlowStub() });

		await page.getByRole('button', { name: 'Create profile', exact: true }).click();
		await expect.element(page.getByRole('heading', { name: 'Create profile' })).toBeVisible();

		await page.getByLabelText('Name').fill('Support engineers');
		await expect.element(page.getByText('2 of 2 tools')).toBeVisible();
		await expect.element(page.getByText('list_issues')).not.toBeInTheDocument();
		await expandServerTools();
		await expect.element(page.getByText('list_issues')).toBeVisible();
		await expect.element(page.getByText('list_pulls')).toBeVisible();
		await page.getByRole('checkbox', { name: 'Enabled' }).nth(1).click();
		await expect.element(page.getByText('1 of 2 tools')).toBeVisible();
		await page.getByRole('button', { name: 'Customize' }).first().click();
		await page.getByLabelText('Tool name').fill('github_list_issues');
		await expect.element(page.getByText('github_list_issues')).toBeVisible();
		await page.getByRole('button', { name: 'Create profile', exact: true }).click();

		await expect
			.element(page.getByRole('button', { name: 'Edit Support engineers' }))
			.toBeVisible();
		await expect.element(page.getByText('0 members · 1 server')).toBeVisible();
	});

	it('edits and deletes an existing profile', async () => {
		render(VMcpProfiles, { vmcp: createVMcp('vmcp-edit-profile'), toolFlow: toolFlowStub() });

		await page.getByRole('button', { name: 'Create profile', exact: true }).click();
		await page.getByLabelText('Name').fill('Developers');
		await page.getByRole('button', { name: 'Create profile', exact: true }).click();

		await page.getByRole('button', { name: 'Edit Developers' }).click();
		await page.getByLabelText('Name').fill('Platform developers');
		await page.getByRole('button', { name: 'Save changes' }).click();

		await expect
			.element(page.getByRole('button', { name: 'Edit Platform developers' }))
			.toBeVisible();
		await page.getByRole('button', { name: 'Delete Platform developers' }).click();
		await expect.element(page.getByText('No profiles yet')).toBeVisible();
	});

	it('requires a unique, non-empty name', async () => {
		render(VMcpProfiles, {
			vmcp: createVMcp('vmcp-profile-validation'),
			toolFlow: toolFlowStub()
		});

		await page.getByRole('button', { name: 'Create profile', exact: true }).click();
		await page.getByRole('button', { name: 'Create profile', exact: true }).click();
		await expect.element(page.getByRole('alert')).toHaveTextContent('Enter a profile name.');

		await page.getByLabelText('Name').fill('Developers');
		await page.getByRole('button', { name: 'Create profile', exact: true }).click();
		await page.getByRole('button', { name: 'Create vMCP' }).click();
		await page.getByLabelText('Name').fill('Developers');
		await page.getByRole('button', { name: 'Create profile', exact: true }).click();

		await expect
			.element(page.getByRole('alert'))
			.toHaveTextContent('A profile with this name already exists.');
	});

	it('writes collected tool overrides onto the profile without updating the vMCP', async () => {
		const collectComponentTools = vi.fn(
			(_component, _vmcp, onCollected: Parameters<VMcpToolFlow['collectComponentTools']>[2]) => {
				onCollected({
					catalogEntryID: 'github',
					toolOverrides: [
						{ name: 'list_issues', enabled: true },
						{ name: 'list_pulls', enabled: true }
					]
				});
			}
		);
		render(VMcpProfiles, {
			vmcp: createVMcp('vmcp-refine-tools', false),
			toolFlow: toolFlowStub({ collectComponentTools })
		});

		await page.getByRole('button', { name: 'Create profile', exact: true }).click();
		await page.getByRole('button', { name: 'Refine tools' }).click();

		expect(collectComponentTools).toHaveBeenCalledOnce();
		await expect.element(page.getByText('2 of 2 tools')).toBeVisible();
		await expect
			.element(page.getByRole('button', { name: 'Refresh tool overrides' }))
			.toBeVisible();
		await expect.element(page.getByText('list_issues')).toBeVisible();
		await expect.element(page.getByText('list_pulls')).toBeVisible();
		await expect.element(page.getByRole('checkbox', { name: 'Enabled' }).first()).toBeChecked();
	});

	it('refreshes existing tool overrides without updating the vMCP', async () => {
		const collectComponentTools = vi.fn(
			(_component, _vmcp, onCollected: Parameters<VMcpToolFlow['collectComponentTools']>[2]) => {
				onCollected({
					catalogEntryID: 'github',
					toolOverrides: [
						{ name: 'list_issues', enabled: true },
						{ name: 'search_code', enabled: true }
					]
				});
			}
		);
		render(VMcpProfiles, {
			vmcp: createVMcp('vmcp-refresh-tools'),
			toolFlow: toolFlowStub({ collectComponentTools })
		});

		await page.getByRole('button', { name: 'Create profile', exact: true }).click();
		await page.getByRole('button', { name: 'Refresh tool overrides' }).click();

		expect(collectComponentTools).toHaveBeenCalledOnce();
		await expect.element(page.getByText('2 of 2 tools')).toBeVisible();
		await expect.element(page.getByText('search_code')).toBeVisible();
		await expect.element(page.getByText('list_pulls')).not.toBeInTheDocument();
	});

	it('collapses and expands the tool override list', async () => {
		render(VMcpProfiles, {
			vmcp: createVMcp('vmcp-collapse-tools'),
			toolFlow: toolFlowStub()
		});

		await page.getByRole('button', { name: 'Create profile', exact: true }).click();
		await expandServerTools();
		await expect.element(page.getByText('list_issues')).toBeVisible();

		await page.getByRole('button', { name: 'Collapse' }).click();
		await expect.element(page.getByText('list_issues')).not.toBeInTheDocument();
		await expect.element(page.getByText('2 of 2 tools')).toBeVisible();

		await expandServerTools();
		await expect.element(page.getByText('list_issues')).toBeVisible();
	});

	it('disables a tool without removing it from the profile list', async () => {
		render(VMcpProfiles, {
			vmcp: createVMcp('vmcp-tool-dropdown'),
			toolFlow: toolFlowStub()
		});

		await page.getByRole('button', { name: 'Create profile', exact: true }).click();
		await expandServerTools();
		await page.getByRole('checkbox', { name: 'Enabled' }).nth(1).click();

		await expect.element(page.getByText('1 of 2 tools')).toBeVisible();
		await expect.element(page.getByText('list_pulls')).toBeVisible();
		await page.getByRole('checkbox', { name: 'Enabled' }).nth(1).click();
		await expect.element(page.getByText('2 of 2 tools')).toBeVisible();
	});

	it('assigns people from the search dropdown', async () => {
		render(VMcpProfiles, {
			vmcp: createVMcp('vmcp-people-dropdown'),
			toolFlow: toolFlowStub()
		});

		await page.getByRole('button', { name: 'Create profile', exact: true }).click();
		await page.getByRole('combobox', { name: 'Add people or groups' }).click();
		await page.getByRole('button', { name: 'All Obot Users', exact: true }).click();

		await expect.element(page.getByText('All Obot Users', { exact: true })).toBeVisible();
		await page.getByRole('button', { name: 'Remove All Obot Users' }).click();
		await expect.element(page.getByText('No people or groups assigned.')).toBeVisible();
	});

	it('keeps the people picker on its placeholder after assigning and removing', async () => {
		render(VMcpProfiles, {
			vmcp: createVMcp('vmcp-people-placeholder'),
			toolFlow: toolFlowStub()
		});

		const picker = page.getByRole('combobox', { name: 'Add people or groups' });

		await page.getByRole('button', { name: 'Create profile', exact: true }).click();
		await picker.click();
		await page.getByRole('button', { name: 'All Obot Users', exact: true }).click();
		await expect.element(picker).toHaveTextContent('Add people or groups');

		await page.getByRole('button', { name: 'Remove All Obot Users' }).click();
		await expect.element(page.getByText('No people or groups assigned.')).toBeVisible();
		await expect.element(picker).toHaveTextContent('Add people or groups');
	});
});
