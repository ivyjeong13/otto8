import { mcpServersAndEntries } from '$lib/stores';
import { createMCPCatalogEntry } from '../../../tests/helpers/mcp';
import { preparePageData } from '../../../tests/helpers/pageData';
import type { PageData } from './$types';
import VMcpDetailPage from './+page.svelte';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';

const componentEntry = createMCPCatalogEntry({
	id: 'entry-github',
	name: 'GitHub'
});

const vmcp = createMCPCatalogEntry({
	id: 'vmcp-1',
	name: 'Issue Tracker vMCP',
	runtime: 'composite',
	manifest: {
		compositeConfig: {
			componentServers: [
				{
					catalogEntryID: componentEntry.id,
					manifest: componentEntry.manifest
				}
			]
		}
	}
});

describe('vMCP detail page', () => {
	it('opens the designer for the loaded vMCP', async () => {
		mcpServersAndEntries.current = {
			entries: [componentEntry, vmcp],
			servers: [],
			userInstances: [],
			userConfiguredServers: [],
			loading: false,
			lastFetched: null,
			isInitialized: true
		};
		const data = await preparePageData<PageData>({ catalogEntry: vmcp });
		render(VMcpDetailPage, { data });

		await expect
			.element(page.getByRole('button', { name: 'Edit Issue Tracker vMCP' }))
			.toBeVisible();
		await expect
			.element(page.getByRole('button', { name: 'Hide servers in Issue Tracker vMCP' }))
			.toBeVisible();
	});
});
