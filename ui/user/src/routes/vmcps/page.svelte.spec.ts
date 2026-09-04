import type { MCPCatalogEntry, MCPCatalogEntryServerManifest, ToolOverride } from '$lib/services';
import { mcpServersAndEntries } from '$lib/stores';
import { createMCPCatalogEntry } from '../../tests/helpers/mcp';
import { preparePageData } from '../../tests/helpers/pageData';
import { worker } from '../../tests/mocks/worker';
import VMcpsPage from './+page.svelte';
import { http, HttpResponse } from 'msw';
import { tick } from 'svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page, userEvent } from 'vitest/browser';

const componentEntry = createMCPCatalogEntry({
	id: 'entry-github',
	name: 'GitHub',
	manifest: {
		toolPreview: [
			{ id: 'create_issue', name: 'create_issue', description: 'Create an issue' },
			{ id: 'list_issues', name: 'list_issues', description: 'List issues' }
		]
	}
});

const toolOverrides: ToolOverride[] = [
	{ name: 'create_issue', description: 'Create an issue', enabled: true },
	{ name: 'list_issues', description: 'List issues', enabled: false }
];

function createVMcp(overrides?: ToolOverride[]) {
	return createMCPCatalogEntry({
		id: 'vmcp-1',
		name: 'Issue Tracker vMCP',
		runtime: 'composite',
		manifest: {
			compositeConfig: {
				componentServers: [
					{
						catalogEntryID: componentEntry.id,
						manifest: componentEntry.manifest,
						toolPrefix: 'github_',
						...(overrides ? { toolOverrides: overrides } : {})
					}
				]
			}
		}
	});
}

async function renderPageWithEntries(entries: MCPCatalogEntry[]) {
	mcpServersAndEntries.current = {
		entries,
		servers: [],
		userInstances: [],
		userConfiguredServers: [],
		loading: false,
		lastFetched: null,
		isInitialized: true
	};
	await preparePageData();
	return render(VMcpsPage);
}

async function renderVMcpsPage(vmcp: MCPCatalogEntry, extraEntries: MCPCatalogEntry[] = []) {
	return renderPageWithEntries([componentEntry, vmcp, ...extraEntries]);
}

function vmcpRow(name = 'Issue Tracker vMCP') {
	return page.getByRole('button', { name, exact: true });
}

async function expandServers(name = 'Issue Tracker vMCP', count = 1) {
	const label = count === 1 ? 'server' : 'servers';
	await page.getByRole('button', { name: `Show ${count} ${label} in ${name}` }).click();
	await tick();
}

/**
 * The page opens on the table and the graph draws one vMCP at a time, so reaching the canvas means
 * picking which vMCP to draw from its row.
 */
async function showGraphView(name = 'Issue Tracker vMCP') {
	await vmcpRow(name).click();
	await expect.element(page.getByRole('button', { name: `Edit ${name}` })).toBeVisible();
	await tick();
}

function componentBlock() {
	return page.getByRole('button', { name: componentEntry.manifest.name!, exact: true });
}

function mockUpdateEntry(vmcp: MCPCatalogEntry, onUpdate: (manifest: unknown) => void) {
	worker.use(
		http.get(`/api/mcp-catalogs/default/entries/${vmcp.id}`, () => HttpResponse.json(vmcp)),
		http.put(`/api/mcp-catalogs/default/entries/${vmcp.id}`, async ({ request }) => {
			const manifest = (await request.json()) as MCPCatalogEntryServerManifest;
			onUpdate(manifest);
			return HttpResponse.json({ ...vmcp, manifest });
		})
	);
}

function componentServersFrom(manifest: unknown) {
	return (manifest as MCPCatalogEntryServerManifest).compositeConfig?.componentServers ?? [];
}

function mockEntryDetails(entry: MCPCatalogEntry) {
	const listServers = vi.fn();
	worker.use(
		http.get(`/api/mcp-catalogs/default/entries/${entry.id}`, () => HttpResponse.json(entry)),
		http.get(`/api/mcp-catalogs/default/entries/${entry.id}/servers`, () => {
			listServers();
			return HttpResponse.json({ items: [] });
		})
	);
	return listServers;
}

function panelCard(name: string) {
	return page.getByRole('button', { name: new RegExp(`View ${name} details`) });
}

function centerOf(el: Element) {
	const rect = el.getBoundingClientRect();
	return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

type Point = { x: number; y: number };

function pointer(el: HTMLElement, type: string, pointerId: number, at: Point) {
	el.dispatchEvent(
		new PointerEvent(type, {
			bubbles: true,
			cancelable: true,
			button: 0,
			pointerId,
			clientX: at.x,
			clientY: at.y
		})
	);
}

async function pressCard(locator: ReturnType<typeof page.getByRole>, pointerId: number) {
	const el = await locator.element();
	if (!(el instanceof HTMLElement)) throw new Error('Expected an HTMLElement');
	// A synthesized pointerId is not a live pointer, so real capture would throw.
	el.setPointerCapture = () => {};

	const from = centerOf(el);
	pointer(el, 'pointerdown', pointerId, from);
	return { el, from };
}

describe('vMCPs Page', () => {
	describe('component with stored tool overrides', () => {
		it('edits the stored overrides instead of running the tool setup flow', async () => {
			await renderVMcpsPage(createVMcp(toolOverrides));
			await showGraphView();

			await componentBlock().click();

			await expect.element(page.getByText('Configure GitHub Tools')).toBeVisible();
			await expect.element(page.getByText('create_issue').first()).toBeVisible();
			await expect.element(page.getByText('list_issues').first()).toBeVisible();
			// The prefix field has no accessible name, and the setup flow keeps a second copy of
			// the same editor mounted, so scope the lookup to the dialog that is open.
			await expect
				.element(page.getByCSS('dialog[open] input[placeholder="No prefix"]'))
				.toHaveValue('github_');
			await expect.element(page.getByRole('button', { name: 'Delete MCP Server' })).toBeVisible();
			await expect.element(page.getByRole('button', { name: 'Refresh Tools' })).toBeVisible();
			await expect
				.element(page.getByRole('button', { name: 'Get Started', exact: true }))
				.not.toBeInTheDocument();
		});

		it('saves the edited overrides back onto the vMCP', async () => {
			const vmcp = createVMcp(toolOverrides);
			const update = vi.fn();
			mockUpdateEntry(vmcp, update);

			await renderVMcpsPage(vmcp);
			await showGraphView();
			await componentBlock().click();

			// Enable the tool that is currently excluded from the composite.
			await page.getByRole('checkbox', { name: 'Enabled' }).nth(1).click();
			await page.getByRole('button', { name: 'Confirm' }).click();

			await vi.waitFor(() => expect(update).toHaveBeenCalled());
			expect(componentServersFrom(update.mock.calls[0][0])[0]).toMatchObject({
				catalogEntryID: componentEntry.id,
				toolPrefix: 'github_',
				toolOverrides: [
					{ name: 'create_issue', enabled: true },
					{ name: 'list_issues', enabled: true }
				]
			});
		});

		it('refreshes tools from the server through the setup flow', async () => {
			await renderVMcpsPage(createVMcp(toolOverrides));
			await showGraphView();

			await componentBlock().click();
			await page.getByRole('button', { name: 'Refresh' }).click();

			await expect
				.element(page.getByRole('button', { name: 'Get Started', exact: true }))
				.toBeVisible();
		});
	});

	describe('component without stored tool overrides', () => {
		it('offers modifying tools or deleting the server', async () => {
			await renderVMcpsPage(createVMcp());
			await showGraphView();

			await componentBlock().click();

			await expect.element(page.getByRole('button', { name: 'Modify Tools' })).toBeVisible();
			await expect.element(page.getByRole('button', { name: 'Delete MCP Server' })).toBeVisible();
			await expect
				.element(page.getByRole('button', { name: 'Get Started', exact: true }))
				.not.toBeInTheDocument();
		});

		it('starts the tool setup flow from Modify Tools', async () => {
			await renderVMcpsPage(createVMcp());
			await showGraphView();

			await componentBlock().click();
			await page.getByRole('button', { name: 'Modify Tools' }).click();

			await expect
				.element(page.getByRole('button', { name: 'Get Started', exact: true }))
				.toBeVisible();
		});

		it('removes the server from the vMCP without visiting the setup flow', async () => {
			const vmcp = createVMcp();
			const update = vi.fn();
			mockUpdateEntry(vmcp, update);

			await renderVMcpsPage(vmcp);
			await showGraphView();
			await componentBlock().click();
			await page.getByRole('button', { name: 'Delete MCP Server' }).click();

			await expect.element(page.getByText('Confirm Remove')).toBeVisible();
			await page.getByRole('button', { name: "Yes, I'm sure" }).click();

			await vi.waitFor(() => expect(update).toHaveBeenCalled());
			expect(componentServersFrom(update.mock.calls[0][0])).toEqual([]);
		});
	});

	describe('dragging a server from the panel onto the canvas', () => {
		const slack = createMCPCatalogEntry({ id: 'entry-slack', name: 'Slack' });
		let listSlackServers: ReturnType<typeof mockEntryDetails>;

		beforeEach(() => {
			listSlackServers = mockEntryDetails(slack);
		});

		function vmcpCard() {
			return page.getByRole('button', { name: 'Edit Issue Tracker vMCP' });
		}

		/** Presses the Slack panel card and drags it over `target`, without releasing. */
		async function dragSlackOnto(target: Element, pointerId: number) {
			const { el } = await pressCard(panelCard('Slack'), pointerId);
			const to = centerOf(target);
			pointer(el, 'pointermove', pointerId, to);
			await tick();
			return { el, to };
		}

		/** Presses the Slack panel card and drags it over the vMCP card, without releasing. */
		async function dragSlackOntoVMcp(pointerId: number) {
			return dragSlackOnto(await vmcpCard().element(), pointerId);
		}

		it('marks both the dragged card and the vMCP it is linked to', async () => {
			await renderVMcpsPage(createVMcp(), [slack]);
			await showGraphView();

			await dragSlackOntoVMcp(12);

			// The panel reads the drag state and the canvas reads the link state, so both
			// updating proves they share one source of truth. The drag ghost carries the same
			// class, so scope the canvas assertion to the vMCP card itself.
			await expect.element(panelCard('Slack')).toHaveClass(/opacity-30/);
			await expect.element(page.getByCSS('.vmcp-drop-target').first()).toBeInTheDocument();
		});

		it('adds the dropped server to the vMCP it landed on', async () => {
			const vmcp = createVMcp();
			const update = vi.fn();
			mockUpdateEntry(vmcp, update);
			await renderVMcpsPage(vmcp, [slack]);
			await showGraphView();

			const { el, to } = await dragSlackOntoVMcp(13);
			pointer(el, 'pointerup', 13, to);

			await vi.waitFor(() => expect(update).toHaveBeenCalled());
			expect(componentServersFrom(update.mock.calls[0][0]).at(-1)).toEqual({
				catalogEntryID: slack.id,
				manifest: slack.manifest
			});
		});

		it('adds the dropped server when the pointer is anywhere on the canvas', async () => {
			const vmcp = createVMcp();
			const update = vi.fn();
			mockUpdateEntry(vmcp, update);
			await renderVMcpsPage(vmcp, [slack]);
			await showGraphView();

			const canvas = await page.getByCSS('[data-vmcp-canvas]').element();
			const rect = canvas.getBoundingClientRect();
			const { el } = await pressCard(panelCard('Slack'), 16);
			const to = { x: rect.right - 16, y: rect.bottom - 16 };
			pointer(el, 'pointermove', 16, to);
			await tick();
			pointer(el, 'pointerup', 16, to);

			await vi.waitFor(() => expect(update).toHaveBeenCalled());
			expect(componentServersFrom(update.mock.calls[0][0]).at(-1)).toEqual({
				catalogEntryID: slack.id,
				manifest: slack.manifest
			});
		});

		it('creates a vMCP from a drop anywhere on the empty canvas', async () => {
			await renderPageWithEntries([componentEntry, slack]);

			const canvas = await page.getByCSS('[data-vmcp-canvas]').element();
			const rect = canvas.getBoundingClientRect();
			const { el } = await pressCard(panelCard('Slack'), 17);
			const to = { x: rect.left + 16, y: rect.top + 16 };
			pointer(el, 'pointermove', 17, to);
			await tick();
			pointer(el, 'pointerup', 17, to);

			await expect.element(page.getByText('Create vMCP')).toBeVisible();
		});

		it('leaves the vMCP alone when Escape cancels the drag before release', async () => {
			const vmcp = createVMcp();
			const update = vi.fn();
			mockUpdateEntry(vmcp, update);
			await renderVMcpsPage(vmcp, [slack]);
			await showGraphView();

			const { el, to } = await dragSlackOntoVMcp(14);
			await userEvent.keyboard('{Escape}');
			pointer(el, 'pointerup', 14, to);
			await tick();

			expect(update).not.toHaveBeenCalled();
			await expect.element(page.getByCSS('.vmcp-drop-target')).not.toBeInTheDocument();
		});

		it('opens the server details when the press never travels far enough to drag', async () => {
			await renderVMcpsPage(createVMcp(), [slack]);
			await showGraphView();

			const { el, from } = await pressCard(panelCard('Slack'), 15);
			pointer(el, 'pointerup', 15, from);

			await expect.element(page.getByRole('dialog').first()).toBeVisible();
			await vi.waitFor(() => expect(listSlackServers).toHaveBeenCalled());
		});
	});

	describe('table view', () => {
		const slack = createMCPCatalogEntry({ id: 'entry-slack', name: 'Slack' });

		beforeEach(() => {
			mockEntryDetails(slack);
		});

		it('takes no drops, so it offers no servers to drag', async () => {
			await renderVMcpsPage(createVMcp(), [slack]);
			await expect.element(vmcpRow()).toBeVisible();

			await expect.element(panelCard('Slack')).not.toBeInTheDocument();
		});
	});

	describe('vMCPs graphs view', () => {
		const extras = [2, 3, 4, 5, 6].map((n) =>
			createMCPCatalogEntry({
				id: `vmcp-${n}`,
				name: `vMCP ${n}`,
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
			})
		);

		async function showTableView() {
			await page.getByRole('button', { name: 'Table View' }).click({ force: true });
		}

		it('draws the vMCP picked from the table, with its servers expanded', async () => {
			await renderVMcpsPage(createVMcp());
			await showGraphView();

			await expect.element(componentBlock()).toBeVisible();
			await expect
				.element(page.getByRole('button', { name: 'Hide servers in Issue Tracker vMCP' }))
				.toHaveAttribute('aria-expanded', 'true');
		});

		it('draws only the selected vMCP, and swaps it for the next one picked', async () => {
			await renderVMcpsPage(createVMcp(), extras);
			await showGraphView();

			await expect
				.element(page.getByRole('button', { name: 'Hide servers in Issue Tracker vMCP' }))
				.toBeVisible();
			await expect
				.element(page.getByRole('button', { name: 'Hide servers in vMCP 2' }))
				.not.toBeInTheDocument();

			await showTableView();
			await showGraphView('vMCP 2');

			await expect
				.element(page.getByRole('button', { name: 'Hide servers in vMCP 2' }))
				.toBeVisible();
			await expect
				.element(page.getByRole('button', { name: 'Hide servers in Issue Tracker vMCP' }))
				.not.toBeInTheDocument();
		});

		it('collapses and re-expands the servers of the selected vMCP', async () => {
			await renderVMcpsPage(createVMcp());
			await showGraphView();

			await page.getByRole('button', { name: 'Hide servers in Issue Tracker vMCP' }).click();
			await tick();

			await expect.element(componentBlock()).not.toBeInTheDocument();

			await expandServers();

			await expect.element(componentBlock()).toBeVisible();
		});

		it('offers vMCP creation on the canvas while nothing is selected', async () => {
			await renderVMcpsPage(createVMcp());

			await page.getByRole('button', { name: 'vMCP Designer' }).click({ force: true });

			await expect.element(page.getByRole('button', { name: /Create New vMCP/ })).toBeVisible();
			await expect.element(page.getByCSS('[data-vmcp-world]')).not.toBeInTheDocument();
			await expect
				.element(page.getByRole('button', { name: 'Edit Issue Tracker vMCP' }))
				.not.toBeInTheDocument();
		});

		it('switches to the table when the toolbar is used by keyboard, tooltip open', async () => {
			const thrown: string[] = [];
			const collect = (event: ErrorEvent) => thrown.push(event.message);
			window.addEventListener('error', collect);
			try {
				await renderVMcpsPage(createVMcp());
				await showGraphView();

				// Focus opens the tooltip, and Enter never sends the pointerdown that would dismiss
				// it, so the button is torn down with its tooltip still open. Closing that tooltip
				// while the view swaps used to be an illegal state write.
				const tableView = await page.getByRole('button', { name: 'Table View' }).element();
				(tableView as HTMLElement).focus();
				await expect.element(page.getByCSS('[role="tooltip"][aria-hidden="false"]')).toBeVisible();
				await userEvent.keyboard('{Enter}');

				await expect.element(vmcpRow()).toBeVisible();
				expect(thrown).toEqual([]);
			} finally {
				window.removeEventListener('error', collect);
			}
		});

		it('zooms the world from the toolbar', async () => {
			await renderVMcpsPage(createVMcp());
			await showGraphView();
			const world = page.getByCSS('[data-vmcp-world]');
			await expect.element(world).toBeInTheDocument();
			const before = (await world.element()).getAttribute('style') ?? '';

			await page.getByRole('button', { name: 'Zoom in' }).click();
			await tick();

			const after = (await world.element()).getAttribute('style') ?? '';
			expect(after).not.toBe(before);
			expect(after).toContain('scale(');
		});

		it('does not pan when dragging from a vMCP card', async () => {
			await renderVMcpsPage(createVMcp());
			await showGraphView();
			const world = await page.getByCSS('[data-vmcp-world]').element();
			const before = world.getAttribute('style');
			const card = await page.getByRole('button', { name: 'Edit Issue Tracker vMCP' }).element();
			card.dispatchEvent(
				new PointerEvent('pointerdown', {
					bubbles: true,
					cancelable: true,
					clientX: 40,
					clientY: 40,
					button: 0,
					pointerId: 7
				})
			);
			card.dispatchEvent(
				new PointerEvent('pointermove', {
					bubbles: true,
					cancelable: true,
					clientX: 120,
					clientY: 90,
					button: 0,
					pointerId: 7
				})
			);
			await tick();
			expect(world.getAttribute('style')).toBe(before);
		});
	});
});
