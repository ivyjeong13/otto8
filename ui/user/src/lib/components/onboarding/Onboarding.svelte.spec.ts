import { mcpServersAndEntries } from '$lib/stores';
import { createMCPCatalogEntry, createMCPCatalogServer } from '../../../tests/helpers/mcp';
import { worker } from '../../../tests/mocks/worker';
import Onboarding from './Onboarding.svelte';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
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

function entryWithCategory(id: string, name: string, categories: string) {
	return createMCPCatalogEntry({
		id,
		name,
		manifest: { metadata: { categories } }
	});
}

function seedCategoryEntries(categories: string[]) {
	mcpServersAndEntries.current = {
		...mcpServersAndEntries.current,
		entries: categories.map((category, index) =>
			entryWithCategory(`entry-${index}`, `${category} Server`, category)
		),
		isInitialized: true,
		lastFetched: Date.now()
	};
}

async function goToInterests() {
	await render(Onboarding);
	await page.getByRole('button', { name: 'Next' }).click();
	await expect
		.element(page.getByRole('heading', { name: 'What brings you to Obot?' }))
		.toBeVisible();
	await expect
		.element(page.getByRole('heading', { name: 'Welcome to Obot!' }))
		.not.toBeInTheDocument();
}

async function goToCurate() {
	await goToInterests();
	await page.getByRole('radio', { name: /curate my org/ }).click();
	await page.getByRole('button', { name: 'Next' }).click();
	await expect
		.element(page.getByRole('heading', { name: 'MCP Servers Preferences' }))
		.toBeVisible();
}

async function goToAccessPolicy(categoryName = /Databases/) {
	await goToCurate();
	await page
		.getByRole('group', { name: 'By Category' })
		.getByRole('checkbox', { name: categoryName })
		.click();
	await page.getByRole('button', { name: 'Continue' }).click();
	await expect.element(page.getByRole('heading', { name: 'Set Up Access Policies' })).toBeVisible();
	await expect
		.element(page.getByRole('heading', { name: 'MCP Servers Preferences' }))
		.not.toBeInTheDocument();
}

describe('InlineAdminOnboarding.svelte', () => {
	beforeEach(() => {
		resetMcpServersAndEntriesStore();
	});

	it('lets the user pick only one usage goal', async () => {
		worker.use(http.put('/api/eula', () => HttpResponse.json({ accepted: true })));
		await goToInterests();

		const curate = page.getByRole('radio', { name: /Curate MCP & Skills/ });
		const monitor = page.getByRole('radio', { name: /Monitor & Detect Shadow AI/ });

		await expect.element(curate).not.toBeChecked();
		await expect.element(monitor).not.toBeChecked();

		await curate.click();
		await expect.element(curate).toBeChecked();
		await expect.element(monitor).not.toBeChecked();

		await monitor.click();
		await expect.element(monitor).toBeChecked();
		await expect.element(curate).not.toBeChecked();
	});

	it('lists categories by entry count, most to least', async () => {
		mcpServersAndEntries.current = {
			...mcpServersAndEntries.current,
			entries: [
				entryWithCategory('net-1', 'Network One', 'Networking'),
				entryWithCategory('prod-1', 'Prod One', 'Productivity'),
				entryWithCategory('prod-2', 'Prod Two', 'Productivity'),
				entryWithCategory('db-1', 'DB One', 'Databases'),
				entryWithCategory('db-2', 'DB Two', 'Databases'),
				entryWithCategory('db-3', 'DB Three', 'Databases')
			],
			isInitialized: true,
			lastFetched: Date.now()
		};

		worker.use(http.put('/api/eula', () => HttpResponse.json({ accepted: true })));
		await goToCurate();

		const categoryCheckboxes = page
			.getByRole('group', { name: 'By Category' })
			.getByRole('checkbox');
		await expect.element(categoryCheckboxes.nth(0)).toHaveAccessibleName(/Databases/);
		await expect.element(categoryCheckboxes.nth(1)).toHaveAccessibleName(/Productivity/);
		await expect.element(categoryCheckboxes.nth(2)).toHaveAccessibleName(/Networking/);
	});

	it('merges duplicate category names that differ by spacing or case', async () => {
		mcpServersAndEntries.current = {
			...mcpServersAndEntries.current,
			entries: [
				entryWithCategory('dt-1', 'Dev Tools One', 'Developer Tools'),
				entryWithCategory('dt-2', 'Dev Tools Two', ' Developer Tools'),
				entryWithCategory('dt-3', 'Dev Tools Three', 'developer tools'),
				entryWithCategory('dt-4', 'Dev Tools Four', 'Business, Developer Tools'),
				entryWithCategory('biz-1', 'Biz One', 'Business')
			],
			isInitialized: true,
			lastFetched: Date.now()
		};

		worker.use(http.put('/api/eula', () => HttpResponse.json({ accepted: true })));
		await goToCurate();

		const categoryGroup = page.getByRole('group', { name: 'By Category' });
		await expect
			.element(categoryGroup.getByRole('checkbox', { name: /Developer Tools/ }))
			.toBeVisible();
		await expect.element(categoryGroup.getByRole('checkbox', { name: /Business/ })).toBeVisible();
		await expect
			.element(categoryGroup.getByRole('checkbox').nth(0))
			.toHaveAccessibleName(/Developer Tools/);
	});

	it('maps google, microsoft, aws, and github categories onto enterprise options', async () => {
		mcpServersAndEntries.current = {
			...mcpServersAndEntries.current,
			entries: [
				entryWithCategory('g1', 'Gmail', 'Google'),
				entryWithCategory('g2', 'Drive', 'google'),
				entryWithCategory('aws1', 'S3', 'AWS'),
				entryWithCategory('gh1', 'Octocat', 'GitHub'),
				entryWithCategory('ms1', 'Outlook', 'Microsoft'),
				entryWithCategory('db1', 'Postgres', 'Databases')
			],
			isInitialized: true,
			lastFetched: Date.now()
		};
		worker.use(http.put('/api/eula', () => HttpResponse.json({ accepted: true })));
		await goToCurate();

		const categoryGroup = page.getByRole('group', { name: 'By Category' });
		await expect.element(categoryGroup.getByRole('checkbox', { name: /Databases/ })).toBeVisible();
		await expect
			.element(categoryGroup.getByRole('checkbox', { name: /Google/ }))
			.not.toBeInTheDocument();
		await expect
			.element(categoryGroup.getByRole('checkbox', { name: /Microsoft/ }))
			.not.toBeInTheDocument();
		await expect
			.element(categoryGroup.getByRole('checkbox', { name: /^AWS$/i }))
			.not.toBeInTheDocument();
		await expect
			.element(categoryGroup.getByRole('checkbox', { name: /GitHub/i }))
			.not.toBeInTheDocument();

		const enterpriseGroup = page.getByRole('group', { name: 'Enterprise MCP Servers' });
		await enterpriseGroup.getByRole('checkbox', { name: /Google/ }).click();
		await page.getByRole('button', { name: 'Continue' }).click();
		await expect
			.element(page.getByRole('heading', { name: 'Set Up Access Policies' }))
			.toBeVisible();

		const recommendedGroup = page.getByRole('group', { name: 'Recommended MCP servers' });
		await expect.element(recommendedGroup.getByRole('checkbox', { name: /Gmail/ })).toBeChecked();
		await expect.element(recommendedGroup.getByRole('checkbox', { name: /Drive/ })).toBeChecked();
		await expect
			.element(recommendedGroup.getByRole('checkbox', { name: /Postgres/ }))
			.not.toBeInTheDocument();
	});

	it('shows the top 6 categories and a search to add the rest', async () => {
		seedCategoryEntries(['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Golf', 'Hotel']);
		worker.use(http.put('/api/eula', () => HttpResponse.json({ accepted: true })));
		await goToCurate();

		const categoryGroup = page.getByRole('group', { name: 'By Category' });
		const categoryCheckboxes = categoryGroup.getByRole('checkbox');
		await expect.element(categoryCheckboxes.nth(0)).toHaveAccessibleName(/Alpha/);
		await expect.element(categoryCheckboxes.nth(5)).toHaveAccessibleName(/Foxtrot/);
		await expect
			.element(categoryGroup.getByRole('checkbox', { name: /Golf/ }))
			.not.toBeInTheDocument();
		await expect
			.element(categoryGroup.getByRole('checkbox', { name: /Hotel/ }))
			.not.toBeInTheDocument();
		await expect.element(page.getByRole('combobox', { name: 'Add a category...' })).toBeVisible();
		await expect.element(page.getByRole('button', { name: 'See All' })).not.toBeInTheDocument();
		await expect
			.element(page.getByRole('button', { name: 'Remove Alpha' }))
			.not.toBeInTheDocument();
	});

	it('adds a searched category as selected and removes it with deselection', async () => {
		seedCategoryEntries(['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Golf', 'Hotel']);
		worker.use(http.put('/api/eula', () => HttpResponse.json({ accepted: true })));
		await goToCurate();

		const continueButton = page.getByRole('button', { name: 'Continue' });
		await expect.element(continueButton).toBeDisabled();

		await page.getByRole('combobox', { name: 'Add a category...' }).click();
		const search = page.getByPlaceholder('Search categories...');
		await expect.element(search).toBeVisible();
		await search.fill('Hotel');
		await page.getByRole('button', { name: 'Hotel' }).click();

		const hotelCheckbox = page.getByRole('group', { name: 'By Category' }).getByRole('checkbox', {
			name: /Hotel/
		});
		await expect.element(hotelCheckbox).toBeChecked();
		await expect.element(continueButton).toBeEnabled();

		await page.getByRole('combobox', { name: 'Add a category...' }).click();
		await expect.element(page.getByPlaceholder('Search categories...')).toBeVisible();
		const categoryPicker = page.getByCSS('#onboarding-add-category-popover');
		await expect
			.element(categoryPicker.getByRole('button', { name: 'Hotel', exact: true }))
			.not.toBeInTheDocument();
		await expect
			.element(categoryPicker.getByRole('button', { name: 'Golf', exact: true }))
			.toBeVisible();
		await page.getByRole('combobox', { name: 'Add a category...' }).click();

		await hotelCheckbox.click();
		await expect.element(hotelCheckbox).not.toBeChecked();
		await expect.element(continueButton).toBeDisabled();

		await hotelCheckbox.click();
		await expect.element(hotelCheckbox).toBeChecked();
		await page.getByRole('button', { name: 'Remove Hotel' }).click();
		await expect.element(hotelCheckbox).not.toBeInTheDocument();
		await expect.element(continueButton).toBeDisabled();
		await expect.element(page.getByRole('combobox', { name: 'Add a category...' })).toBeVisible();
	});

	it('adds a searched MCP that was not in the recommended list', async () => {
		mcpServersAndEntries.current = {
			...mcpServersAndEntries.current,
			entries: [
				entryWithCategory('pg', 'Postgres', 'Databases'),
				entryWithCategory('my', 'MySQL', 'Databases'),
				entryWithCategory('slack', 'Slack', 'Communication')
			],
			servers: [
				createMCPCatalogServer({
					id: 'gateway',
					name: 'Custom Gateway',
					userID: 'user-1',
					manifest: { metadata: { categories: 'Networking' } }
				})
			],
			isInitialized: true,
			lastFetched: Date.now()
		};
		worker.use(http.put('/api/eula', () => HttpResponse.json({ accepted: true })));
		await goToAccessPolicy();

		const recommendedGroup = page.getByRole('group', { name: 'Recommended MCP servers' });
		await expect
			.element(recommendedGroup.getByRole('checkbox', { name: /Postgres/ }))
			.toBeChecked();
		await expect.element(recommendedGroup.getByRole('checkbox', { name: /MySQL/ })).toBeChecked();
		await expect
			.element(recommendedGroup.getByRole('checkbox', { name: /Slack/ }))
			.not.toBeInTheDocument();

		await page.getByRole('combobox', { name: 'Add an MCP server...' }).click();
		const search = page.getByPlaceholder('Search MCP servers...');
		await expect.element(search).toBeVisible();
		await search.fill('Slack');
		await page.getByRole('button', { name: 'Slack', exact: true }).click();

		const slackCheckbox = recommendedGroup.getByRole('checkbox', { name: /Slack/ });
		await expect.element(slackCheckbox).toBeChecked();
		await expect.element(page.getByRole('button', { name: 'Remove Slack' })).toBeVisible();

		await page.getByRole('combobox', { name: 'Add an MCP server...' }).click();
		await expect.element(page.getByPlaceholder('Search MCP servers...')).toBeVisible();
		const mcpPicker = page.getByCSS('#onboarding-add-mcp-popover');
		await expect
			.element(mcpPicker.getByRole('button', { name: 'Slack', exact: true }))
			.not.toBeInTheDocument();
		await expect
			.element(mcpPicker.getByRole('button', { name: 'Custom Gateway', exact: true }))
			.toBeVisible();
		await page.getByRole('combobox', { name: 'Add an MCP server...' }).click();

		await slackCheckbox.click();
		await expect.element(slackCheckbox).not.toBeChecked();
		await slackCheckbox.click();
		await page.getByRole('button', { name: 'Remove Slack' }).click();
		await expect.element(slackCheckbox).not.toBeInTheDocument();
		await expect
			.element(page.getByRole('combobox', { name: 'Add an MCP server...' }))
			.toBeVisible();
	});

	it('replaces the MCP list with All MCP Servers and clears selection on remove', async () => {
		mcpServersAndEntries.current = {
			...mcpServersAndEntries.current,
			entries: [
				entryWithCategory('pg', 'Postgres', 'Databases'),
				entryWithCategory('my', 'MySQL', 'Databases'),
				entryWithCategory('slack', 'Slack', 'Communication')
			],
			isInitialized: true,
			lastFetched: Date.now()
		};
		worker.use(http.put('/api/eula', () => HttpResponse.json({ accepted: true })));
		await goToAccessPolicy();

		const recommendedGroup = page.getByRole('group', { name: 'Recommended MCP servers' });
		await page.getByRole('combobox', { name: 'Add an MCP server...' }).click();
		await page.getByRole('button', { name: 'All MCP Servers', exact: true }).click();

		await expect
			.element(recommendedGroup.getByRole('checkbox', { name: /All MCP Servers/ }))
			.toBeChecked();
		await expect
			.element(recommendedGroup.getByRole('checkbox', { name: /Postgres/ }))
			.not.toBeInTheDocument();
		await expect
			.element(recommendedGroup.getByRole('checkbox', { name: /MySQL/ }))
			.not.toBeInTheDocument();

		await page.getByRole('button', { name: 'Remove All MCP Servers' }).click();
		await expect
			.element(recommendedGroup.getByRole('checkbox', { name: /All MCP Servers/ }))
			.not.toBeInTheDocument();
		await expect
			.element(recommendedGroup.getByRole('checkbox', { name: /Postgres/ }))
			.not.toBeChecked();
		await expect
			.element(recommendedGroup.getByRole('checkbox', { name: /MySQL/ }))
			.not.toBeChecked();
	});

	it('removes All MCP Servers when a specific MCP is added after it', async () => {
		mcpServersAndEntries.current = {
			...mcpServersAndEntries.current,
			entries: [
				entryWithCategory('pg', 'Postgres', 'Databases'),
				entryWithCategory('my', 'MySQL', 'Databases'),
				entryWithCategory('slack', 'Slack', 'Communication')
			],
			isInitialized: true,
			lastFetched: Date.now()
		};
		worker.use(http.put('/api/eula', () => HttpResponse.json({ accepted: true })));
		await goToAccessPolicy();

		const recommendedGroup = page.getByRole('group', { name: 'Recommended MCP servers' });
		await page.getByRole('combobox', { name: 'Add an MCP server...' }).click();
		await page.getByRole('button', { name: 'All MCP Servers', exact: true }).click();
		await expect
			.element(recommendedGroup.getByRole('checkbox', { name: /All MCP Servers/ }))
			.toBeVisible();

		await page.getByRole('combobox', { name: 'Add an MCP server...' }).click();
		const search = page.getByPlaceholder('Search MCP servers...');
		await expect.element(search).toBeVisible();
		await search.fill('Slack');
		await page.getByRole('button', { name: 'Slack', exact: true }).click();

		await expect
			.element(recommendedGroup.getByRole('checkbox', { name: /All MCP Servers/ }))
			.not.toBeInTheDocument();
		await expect.element(recommendedGroup.getByRole('checkbox', { name: /Slack/ })).toBeChecked();
		await expect
			.element(recommendedGroup.getByRole('checkbox', { name: /Postgres/ }))
			.toBeChecked();
	});
});
