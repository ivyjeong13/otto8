import type { MCPCatalogEntryServerManifest } from '$lib/services';
import { createMCPCatalogEntry } from '../../../tests/helpers/mcp';
import { preparePageData } from '../../../tests/helpers/pageData';
import { worker } from '../../../tests/mocks/worker';
import CreateEditVMcp from './CreateEditVMcp.svelte';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';

const vmcp = createMCPCatalogEntry({
	id: 'vmcp-1',
	name: 'Gmail vMCP'
});

async function renderEditor() {
	await preparePageData();
	return render(CreateEditVMcp);
}

describe('CreateEditVMcp.svelte', () => {
	it('opens the edit dialog with name and description only', async () => {
		const result = await renderEditor();
		result.component.openEdit(vmcp);

		await expect
			.element(page.getByRole('textbox', { name: 'Name' }))
			.toHaveValue(vmcp.manifest.name!);
		await expect
			.element(page.getByRole('textbox', { name: 'Description' }))
			.toHaveValue(vmcp.manifest.shortDescription!);
		await expect.element(page.getByText('Access Policies')).not.toBeInTheDocument();
		await expect
			.element(page.getByRole('button', { name: 'Add access policy' }))
			.not.toBeInTheDocument();
	});

	it('creates a vMCP with the supplied component server and its prefilled details', async () => {
		const entry = createMCPCatalogEntry({ id: 'entry-gmail', name: 'Gmail' });
		const createRequest = vi.fn();

		worker.use(
			http.post('/api/mcp-catalogs/default/entries', async ({ request }) => {
				const manifest = (await request.json()) as MCPCatalogEntryServerManifest;
				createRequest(manifest);
				return HttpResponse.json({ ...vmcp, manifest });
			})
		);

		const result = await renderEditor();
		result.component.openCreate([{ catalogEntryID: entry.id, manifest: entry.manifest }]);

		await expect
			.element(page.getByRole('textbox', { name: 'Name' }))
			.toHaveValue(entry.manifest.name!);
		await expect
			.element(page.getByRole('textbox', { name: 'Description' }))
			.toHaveValue(entry.manifest.shortDescription!);

		await page.getByRole('button', { name: 'Create' }).click();

		await vi.waitFor(() => expect(createRequest).toHaveBeenCalled());
		expect(createRequest.mock.calls[0][0].compositeConfig.componentServers).toEqual([
			{ catalogEntryID: entry.id, manifest: entry.manifest }
		]);
	});
});
