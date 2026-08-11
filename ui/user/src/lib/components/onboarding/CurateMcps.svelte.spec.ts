import { mcpServersAndEntries } from '$lib/stores';
import type { MCPCatalogEntry, MCPCatalogServer } from '$lib/services';
import { createMCPCatalogEntry, createMCPCatalogServer } from '../../../tests/helpers/mcp';
import { worker } from '../../../tests/mocks/worker';
import CurateMcps from './CurateMcps.svelte';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';

function resetMcpServersAndEntriesStore() {
	mcpServersAndEntries.current = {
		entries: [],
		servers: [],
		userInstances: [],
		userConfiguredServers: [],
		loading: false,
		lastFetched: null,
		isInitialized: false
	};
}

function mockAccessPolicySave() {
	worker.use(
		http.delete('/api/mcp-catalogs/default/access-control-rules/acr1-everything', () => {
			return new HttpResponse(null, { status: 204 });
		}),
		http.post('/api/mcp-catalogs/default/access-control-rules', () => {
			return HttpResponse.json({ id: 'acr-new' });
		})
	);
}

const postgres = createMCPCatalogEntry({
	id: 'pg',
	name: 'Postgres',
	connectURL: 'https://obot.example/mcp/postgres',
	manifest: { metadata: { categories: 'Databases' } }
});
const mysql = createMCPCatalogEntry({
	id: 'my',
	name: 'MySQL',
	connectURL: 'https://obot.example/mcp/mysql',
	manifest: { metadata: { categories: 'Databases' } }
});
const slack = createMCPCatalogEntry({
	id: 'slack',
	name: 'Slack',
	connectURL: 'https://obot.example/mcp/slack',
	manifest: { metadata: { categories: 'Communication' } }
});
const gateway = createMCPCatalogServer({
	id: 'gateway',
	name: 'Custom Gateway',
	userID: 'user-1',
	connectURL: 'https://obot.example/mcp/gateway',
	manifest: { metadata: { categories: 'Networking' } }
});

const databaseDataset: Record<string, (MCPCatalogEntry | MCPCatalogServer)[]> = {
	Databases: [postgres, mysql]
};

async function renderCurate(
	dataset: Record<string, (MCPCatalogEntry | MCPCatalogServer)[]> = databaseDataset,
	{
		entries = [postgres, mysql],
		servers = [] as MCPCatalogServer[]
	}: { entries?: MCPCatalogEntry[]; servers?: MCPCatalogServer[] } = {}
) {
	mcpServersAndEntries.current = {
		...mcpServersAndEntries.current,
		entries,
		servers,
		isInitialized: true,
		lastFetched: Date.now()
	};

	await render(CurateMcps, {
		boxClasses: '',
		dataset,
		onBack: vi.fn(),
		onDone: vi.fn()
	});
}

async function goToAccessPolicy() {
	await page
		.getByRole('group', { name: 'By Category' })
		.getByRole('checkbox', { name: /Databases/ })
		.click();
	await page.getByRole('button', { name: 'Continue' }).click();
	await expect.element(page.getByRole('heading', { name: 'Set Up Access Policies' })).toBeVisible();
}

function mockConfiguredServers(servers: MCPCatalogServer[]) {
	worker.use(
		http.get('/api/mcp-servers', () => {
			return HttpResponse.json({ items: servers });
		})
	);
}

function returnToWindow(state: DocumentVisibilityState = 'visible') {
	Object.defineProperty(document, 'visibilityState', {
		configurable: true,
		get: () => state
	});
	document.dispatchEvent(new Event('visibilitychange'));
}

async function goToConnect() {
	mockAccessPolicySave();
	await page.getByRole('button', { name: 'Continue' }).click();
	await expect.element(page.getByRole('heading', { name: 'Connect Your AI Client' })).toBeVisible();
}

describe('CurateMcps.svelte', () => {
	beforeEach(() => {
		resetMcpServersAndEntriesStore();
	});

	it('lets the user pick a checked access-policy MCP and shows HowToConnect', async () => {
		await renderCurate();
		await goToAccessPolicy();
		await goToConnect();

		const picker = page.getByRole('combobox', { name: 'Select an MCP server...' });
		await expect.element(picker).toBeVisible();
		await expect.element(picker).toHaveTextContent('MySQL');
		await expect.element(page.getByCSS('#magic-link-cursor')).toBeVisible();
		await expect
			.element(page.getByCSS('#magic-link-cursor'))
			.toHaveAttribute('href', /MySQL/);

		await picker.click();
		await page.getByPlaceholder('Search MCP servers...').fill('Postgres');
		await page.getByRole('button', { name: 'Postgres', exact: true }).click();

		await expect.element(picker).toHaveTextContent('Postgres');
		await expect
			.element(page.getByCSS('#magic-link-cursor'))
			.toHaveAttribute('href', /Postgres/);
	});

	it('omits unchecked access-policy MCPs from the connect picker', async () => {
		await renderCurate();
		await goToAccessPolicy();

		await page
			.getByRole('group', { name: 'Recommended MCP servers' })
			.getByRole('checkbox', { name: /MySQL/ })
			.click();
		await goToConnect();

		const picker = page.getByRole('combobox', { name: 'Select an MCP server...' });
		await expect.element(picker).toHaveTextContent('Postgres');
		await picker.click();
		const popover = page.getByCSS('#onboarding-connect-mcp-popover');
		await expect.element(popover.getByRole('button', { name: 'Postgres', exact: true })).toBeVisible();
		await expect
			.element(popover.getByRole('button', { name: 'MySQL', exact: true }))
			.not.toBeInTheDocument();
	});

	it('lists every catalog server and entry when All MCP Servers was selected', async () => {
		await renderCurate(
			{ Databases: [postgres, mysql], Communication: [slack], Networking: [gateway] },
			{ entries: [postgres, mysql, slack], servers: [gateway] }
		);
		await goToAccessPolicy();
		await page.getByRole('combobox', { name: 'Add an MCP server...' }).click();
		await page.getByRole('button', { name: 'All MCP Servers', exact: true }).click();
		await goToConnect();

		await page.getByRole('combobox', { name: 'Select an MCP server...' }).click();
		const popover = page.getByCSS('#onboarding-connect-mcp-popover');
		await expect
			.element(popover.getByRole('button', { name: 'Custom Gateway', exact: true }))
			.toBeVisible();
		await expect.element(popover.getByRole('button', { name: 'Slack', exact: true })).toBeVisible();
		await expect.element(popover.getByRole('button', { name: 'MySQL', exact: true })).toBeVisible();
		await expect
			.element(popover.getByRole('button', { name: 'Postgres', exact: true }))
			.toBeVisible();
	});

	it('moves to interact when the selected MCP becomes configured after returning to the window', async () => {
		await renderCurate();
		await goToAccessPolicy();
		await goToConnect();

		mockConfiguredServers([
			createMCPCatalogServer({
				id: 'ms-my',
				name: 'MySQL',
				userID: 'user-1',
				catalogEntryID: 'my',
				connectURL: 'https://obot.example/mcp/mysql'
			})
		]);
		returnToWindow('visible');

		await expect
			.element(page.getByRole('heading', { name: 'Interact w/ Your MCP Server' }))
			.toBeVisible();
		await expect
			.element(page.getByRole('heading', { name: 'Connect Your AI Client' }))
			.not.toBeInTheDocument();
	});

	it('stays on connect when returning to the window if the selected MCP is not configured', async () => {
		await renderCurate();
		await goToAccessPolicy();
		await goToConnect();

		mockConfiguredServers([]);
		returnToWindow('visible');

		await expect.element(page.getByRole('heading', { name: 'Connect Your AI Client' })).toBeVisible();
		await expect
			.element(page.getByRole('heading', { name: 'Interact w/ Your MCP Server' }))
			.not.toBeInTheDocument();
	});

	it('moves to interact when the window is refocused after the selected MCP is configured', async () => {
		await renderCurate();
		await goToAccessPolicy();
		await goToConnect();

		mockConfiguredServers([
			createMCPCatalogServer({
				id: 'ms-my',
				name: 'MySQL',
				userID: 'user-1',
				catalogEntryID: 'my',
				connectURL: 'https://obot.example/mcp/mysql'
			})
		]);
		window.dispatchEvent(new Event('focus'));

		await expect
			.element(page.getByRole('heading', { name: 'Interact w/ Your MCP Server' }))
			.toBeVisible();
	});
});
