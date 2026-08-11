import { mcpServersAndEntries } from '$lib/stores';
import { worker } from '../../../tests/mocks/worker';
import ConnectBasicMcps from './ConnectBasicMcps.svelte';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

async function renderAndConnect(variant: 'gmail' | 'outlook', onDone = vi.fn()) {
	await render(ConnectBasicMcps, {
		boxClasses: '',
		onBack: vi.fn(),
		onDone,
		variant
	});

	await page.getByRole('radio', { name: 'Cursor' }).click();
	await page.getByRole('button', { name: 'Continue' }).click();
	await expect.element(page.getByRole('heading', { name: 'Organize Your Day!' })).toBeVisible();

	return onDone;
}

function mockAuditLogs(items: unknown[] | null) {
	const listAuditLogs = vi.fn();
	worker.use(
		http.get('/api/mcp-audit-logs', ({ request }) => {
			listAuditLogs(new URL(request.url));
			return HttpResponse.json({
				items,
				total: items?.length ?? 0,
				offset: 0,
				limit: 1
			});
		})
	);
	return listAuditLogs;
}

function setDocumentVisibility(state: DocumentVisibilityState) {
	Object.defineProperty(document, 'visibilityState', {
		configurable: true,
		get: () => state
	});
}

function returnToTab(state: DocumentVisibilityState) {
	setDocumentVisibility(state);
	document.dispatchEvent(new Event('visibilitychange'));
}

function refocusWindow() {
	window.dispatchEvent(new Event('focus'));
}

function expectTenMinuteLookback(url: URL) {
	const start = Date.parse(url.searchParams.get('start_time') ?? '');
	const end = Date.parse(url.searchParams.get('end_time') ?? '');
	expect(end - start).toBe(10 * 60 * 1000);
	expect(url.searchParams.get('limit')).toBe('1');
}

describe('ConnectBasicMcps.svelte', () => {
	beforeEach(() => {
		resetMcpServersAndEntriesStore();
		setDocumentVisibility('visible');
	});

	afterEach(() => {
		setDocumentVisibility('visible');
	});

	it('shows copyable Gmail and Calendar prompts after connecting', async () => {
		await renderAndConnect('gmail');

		await expect.element(page.getByText('Plan your day')).toBeVisible();
		await expect
			.element(
				page.getByText(
					"Review my unread Gmail from this morning and today's Google Calendar. Summarize what needs my attention and propose a prioritized plan for the rest of the day."
				)
			)
			.toBeVisible();
		await expect
			.element(
				page.getByText(
					'Find Gmail threads that need a reply today, draft responses I can send, and block 30 minutes on my Google Calendar this afternoon to work through them.'
				)
			)
			.toBeVisible();
		await expect
			.element(
				page.getByText(
					"Look at my Google Calendar for the rest of the week. For any meeting I'm unprepared for, pull related Gmail threads, draft a short brief, and add a 15-minute prep block before each one."
				)
			)
			.toBeVisible();
	});

	it('shows copyable Outlook prompts after connecting', async () => {
		await renderAndConnect('outlook');

		await expect
			.element(
				page.getByText(
					"Review my unread Outlook emails from this morning and today's Outlook calendar. Summarize what needs my attention and propose a prioritized plan for the rest of the day."
				)
			)
			.toBeVisible();
		await expect
			.element(
				page.getByText(
					'Find Outlook emails that need a reply today, draft responses I can send, and block 30 minutes on my calendar this afternoon to work through them.'
				)
			)
			.toBeVisible();
		await expect.element(page.getByText(/Gmail/)).not.toBeInTheDocument();
	});

	it('finishes onboarding when returning to the tab after a recent MCP interaction', async () => {
		const listAuditLogs = mockAuditLogs([{ id: 'evt-1' }]);
		const onDone = await renderAndConnect('gmail');

		returnToTab('visible');

		await vi.waitFor(() => {
			expect(onDone).toHaveBeenCalledOnce();
		});
		expectTenMinuteLookback(listAuditLogs.mock.calls[0][0] as URL);
	});

	it('does not finish onboarding when there is no recent MCP interaction', async () => {
		const listAuditLogs = mockAuditLogs([]);
		const onDone = await renderAndConnect('gmail');

		returnToTab('visible');

		await vi.waitFor(() => {
			expect(listAuditLogs).toHaveBeenCalled();
		});
		expect(onDone).not.toHaveBeenCalled();
	});

	it('does not check audit logs while the tab is hidden', async () => {
		const listAuditLogs = mockAuditLogs([{ id: 'evt-1' }]);
		const onDone = await renderAndConnect('gmail');

		returnToTab('hidden');

		expect(listAuditLogs).not.toHaveBeenCalled();
		expect(onDone).not.toHaveBeenCalled();
	});

	it('finishes onboarding when the window is refocused without changing tabs', async () => {
		const listAuditLogs = mockAuditLogs([{ id: 'evt-1' }]);
		const onDone = await renderAndConnect('gmail');

		refocusWindow();

		await vi.waitFor(() => {
			expect(onDone).toHaveBeenCalledOnce();
		});
		expectTenMinuteLookback(listAuditLogs.mock.calls[0][0] as URL);
	});

	it('does not finish on window focus when there is no recent MCP interaction', async () => {
		const listAuditLogs = mockAuditLogs([]);
		const onDone = await renderAndConnect('gmail');

		refocusWindow();

		await vi.waitFor(() => {
			expect(listAuditLogs).toHaveBeenCalled();
		});
		expect(onDone).not.toHaveBeenCalled();
	});

	it('does not check audit logs on window focus while the tab is hidden', async () => {
		const listAuditLogs = mockAuditLogs([{ id: 'evt-1' }]);
		const onDone = await renderAndConnect('gmail');

		setDocumentVisibility('hidden');
		refocusWindow();

		expect(listAuditLogs).not.toHaveBeenCalled();
		expect(onDone).not.toHaveBeenCalled();
	});
});
