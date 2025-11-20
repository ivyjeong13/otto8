<script lang="ts">
	import McpServerEntryForm from '$lib/components/admin/McpServerEntryForm.svelte';
	import Layout from '$lib/components/Layout.svelte';
	import { PAGE_TRANSITION_DURATION } from '$lib/constants';
	import { ChatService, type MCPCatalogServer } from '$lib/services';
	import type { MCPCatalogEntry } from '$lib/services/admin/types';
	import { LoaderCircle, Plus, Server } from 'lucide-svelte';
	import { onMount } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import { goto } from '$app/navigation';
	import { afterNavigate } from '$app/navigation';
	import { browser } from '$app/environment';
	import Search from '$lib/components/Search.svelte';
	import {
		fetchMcpServerAndEntries,
		getPoweruserWorkspace,
		initMcpServerAndEntries
	} from '$lib/context/poweruserWorkspace.svelte';
	import SelectServerType, {
		type SelectServerOption
	} from '$lib/components/mcp/SelectServerType.svelte';
	import { getServerTypeLabelByType } from '$lib/services/chat/mcp.js';
	import McpConfirmDelete from '$lib/components/mcp/McpConfirmDelete.svelte';
	import DeploymentsView from '$lib/components/mcp/DeploymentsView.svelte';
	import {
		clearUrlParams,
		getTableUrlParamsFilters,
		getTableUrlParamsSort,
		setFilterUrlParams,
		setSortUrlParams
	} from '$lib/url';

	let { data } = $props();
	let query = $state('');
	let workspaceId = $derived(data.workspace?.id);

	initMcpServerAndEntries();
	const mcpServerAndEntries = getPoweruserWorkspace();

	onMount(async () => {
		if (workspaceId) {
			await fetchMcpServerAndEntries(workspaceId, mcpServerAndEntries);
		}
	});

	afterNavigate(({ to }) => {
		if (browser && to?.url) {
			const serverId = to.url.searchParams.get('id');
			const createNewType = to.url.searchParams.get('new') as 'single' | 'multi' | 'remote';
			if (createNewType) {
				selectServerType(createNewType, false);
			} else if (!serverId && (selectedEntryServer || showServerForm)) {
				selectedEntryServer = undefined;
				showServerForm = false;
			}
		}
	});

	let selectServerTypeDialog = $state<ReturnType<typeof SelectServerType>>();
	let selectedServerType = $state<SelectServerOption>();
	let selectedEntryServer = $state<MCPCatalogEntry | MCPCatalogServer>();

	let showServerForm = $state(false);
	let deletingEntry = $state<MCPCatalogEntry>();
	let deletingServer = $state<MCPCatalogServer>();

	let urlFilters = $state(getTableUrlParamsFilters());
	let initSort = $derived(getTableUrlParamsSort());

	function selectServerType(type: SelectServerOption, updateUrl = true) {
		selectedServerType = type;
		selectServerTypeDialog?.close();
		showServerForm = true;
		if (updateUrl) {
			goto(`/mcp-servers?new=${type}`, { replaceState: false });
		}
	}

	function handleFilter(property: string, values: string[]) {
		urlFilters[property] = values;
		setFilterUrlParams(property, values);
	}

	function handleClearAllFilters() {
		urlFilters = {};
		clearUrlParams();
	}

	const duration = PAGE_TRANSITION_DURATION;
	let title = $derived(
		showServerForm ? `Create ${getServerTypeLabelByType(selectedServerType)} Server` : 'MCP Servers'
	);
</script>

<Layout showUserLinks {title} showBackButton={showServerForm}>
	<div class="flex flex-col gap-8 pt-4 pb-8" in:fade>
		{#if showServerForm}
			{@render configureEntryScreen()}
		{:else}
			{@render mainContent()}
		{/if}
	</div>

	{#snippet rightNavActions()}
		{@render addServerButton()}
	{/snippet}
</Layout>

{#snippet mainContent()}
	<div
		class="flex flex-col gap-4 md:gap-8"
		in:fly={{ x: 100, delay: duration, duration }}
		out:fly={{ x: -100, duration }}
	>
		<div class="flex flex-col gap-2">
			<Search
				class="dark:bg-surface1 dark:border-surface3 border border-transparent bg-white shadow-sm"
				onChange={(val) => (query = val)}
				placeholder="Search servers..."
			/>

			{#if mcpServerAndEntries.loading}
				<div class="my-2 flex items-center justify-center">
					<LoaderCircle class="size-6 animate-spin" />
				</div>
			{:else}
				<DeploymentsView
					entity="workspace"
					{query}
					{urlFilters}
					onFilter={handleFilter}
					onClearAllFilters={handleClearAllFilters}
					onSort={setSortUrlParams}
					{initSort}
				>
					{#snippet noDataContent()}
						<div class="mt-12 flex w-md flex-col items-center gap-4 self-center text-center">
							<Server class="size-24 text-gray-200 dark:text-gray-900" />
							<h4 class="text-lg font-semibold text-gray-400 dark:text-gray-600">
								No created MCP servers
							</h4>
							<p class="text-sm font-light text-gray-400 dark:text-gray-600">
								Looks like you don't have any servers created yet. <br />
								Click the button below to get started.
							</p>

							{@render addServerButton()}
						</div>
					{/snippet}
				</DeploymentsView>
			{/if}
		</div>
	</div>
{/snippet}

{#snippet configureEntryScreen()}
	<div class="flex flex-col gap-6" in:fly={{ x: 100, delay: duration, duration }}>
		{#if selectedServerType !== 'search'}
			<McpServerEntryForm
				type={selectedServerType}
				id={workspaceId}
				entity="workspace"
				onCancel={() => {
					selectedEntryServer = undefined;
					showServerForm = false;
				}}
				onSubmit={async (id, type) => {
					if (type === 'single' || type === 'remote') {
						goto(`/mcp-servers/c/${id}`);
					} else {
						goto(`/mcp-servers/s/${id}`);
					}
				}}
			/>
		{/if}
	</div>
{/snippet}

{#snippet addServerButton()}
	<button
		class="button-primary flex w-full items-center gap-1 text-sm md:w-fit"
		onclick={() => {
			selectServerTypeDialog?.open();
		}}
	>
		<Plus class="size-4" /> Add MCP Server
	</button>
{/snippet}

<McpConfirmDelete
	names={[deletingEntry?.manifest?.name ?? '']}
	show={Boolean(deletingEntry)}
	onsuccess={async () => {
		if (!deletingEntry || !workspaceId) {
			return;
		}

		await ChatService.deleteWorkspaceMCPCatalogEntry(workspaceId, deletingEntry.id);
		await fetchMcpServerAndEntries(workspaceId, mcpServerAndEntries);
		deletingEntry = undefined;
	}}
	oncancel={() => (deletingEntry = undefined)}
	entity="entry"
	entityPlural="entries"
/>

<McpConfirmDelete
	names={[deletingServer?.manifest?.name ?? '']}
	show={Boolean(deletingServer)}
	onsuccess={async () => {
		if (!deletingServer || !workspaceId) {
			return;
		}

		await ChatService.deleteWorkspaceMCPCatalogServer(workspaceId, deletingServer.id);
		await fetchMcpServerAndEntries(workspaceId, mcpServerAndEntries);
		deletingServer = undefined;
	}}
	oncancel={() => (deletingServer = undefined)}
	entity="entry"
	entityPlural="entries"
/>

<SelectServerType
	bind:this={selectServerTypeDialog}
	onSelectServerType={selectServerType}
	type="server"
/>

<svelte:head>
	<title>Obot | MCP Servers</title>
</svelte:head>
