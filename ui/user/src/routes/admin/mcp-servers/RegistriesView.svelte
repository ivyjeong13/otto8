<script lang="ts">
	import { tooltip } from '$lib/actions/tooltip.svelte';
	import Confirm from '$lib/components/Confirm.svelte';
	import ResponsiveDialog from '$lib/components/ResponsiveDialog.svelte';
	import Search from '$lib/components/Search.svelte';
	import Table from '$lib/components/table/Table.svelte';
	import {
		fetchMcpServerAndEntries,
		getAdminMcpServerAndEntries
	} from '$lib/context/admin/mcpServerAndEntries.svelte';
	import {
		AdminService,
		type MCPCatalog,
		type MCPCatalogEntry,
		type MCPCatalogServer,
		type OrgUser
	} from '$lib/services';
	import { convertEntriesAndServersToTableData } from '$lib/services/chat/mcp';
	import { formatTimeAgo } from '$lib/time';
	import { openUrl } from '$lib/utils';
	import {
		AlertTriangle,
		Eye,
		Info,
		LoaderCircle,
		RefreshCcw,
		Server,
		Trash2,
		TriangleAlert
	} from 'lucide-svelte';
	import type { Snippet } from 'svelte';
	import { slide } from 'svelte/transition';

	interface Props {
		catalog?: MCPCatalog;
		readonly?: boolean;
		emptyContentButton?: Snippet;
		usersMap?: Map<string, OrgUser>;
		syncing?: boolean;
		onSync?: () => void;
	}

	let {
		catalog = $bindable(),
		readonly,
		emptyContentButton,
		usersMap,
		syncing,
		onSync
	}: Props = $props();
	let search = $state('');

	let deletingEntry = $state<MCPCatalogEntry>();
	let deletingServer = $state<MCPCatalogServer>();
	let deletingSource = $state<string>();

	let syncError = $state<{ url: string; error: string }>();
	let syncErrorDialog = $state<ReturnType<typeof ResponsiveDialog>>();

	const mcpServerAndEntries = getAdminMcpServerAndEntries();
	let tableData = $derived(
		convertEntriesAndServersToTableData(
			mcpServerAndEntries.entries,
			mcpServerAndEntries.servers,
			usersMap
		)
	);
	let filteredTableData = $derived(
		tableData
			.filter(
				(d) =>
					d.name.toLowerCase().includes(search.toLowerCase()) ||
					d.registry.toLowerCase().includes(search.toLowerCase())
			)
			.sort((a, b) => {
				return a.name.localeCompare(b.name);
			})
	);
</script>

{#if catalog?.isSyncing}
	<div class="notification-info p-3 text-sm font-light">
		<div class="flex items-center gap-3">
			<Info class="size-6" />
			<div>The catalog is currently syncing with your configured Git repositories.</div>
		</div>
	</div>
{/if}

<div class="flex flex-col gap-2">
	<Search
		class="dark:bg-surface1 dark:border-surface3 border border-transparent bg-white shadow-sm"
		onChange={(val) => (search = val)}
		placeholder="Search servers..."
	/>

	{#if mcpServerAndEntries.loading}
		<div class="my-2 flex items-center justify-center">
			<LoaderCircle class="size-6 animate-spin" />
		</div>
	{:else if mcpServerAndEntries.entries.length + mcpServerAndEntries.servers.length === 0}
		<div class="mt-12 flex w-md flex-col items-center gap-4 self-center text-center">
			<Server class="size-24 text-gray-200 dark:text-gray-900" />
			<h4 class="text-lg font-semibold text-gray-400 dark:text-gray-600">No created MCP servers</h4>
			<p class="text-sm font-light text-gray-400 dark:text-gray-600">
				Looks like you don't have any servers created yet. <br />
				Click the button below to get started.
			</p>

			{#if !readonly && emptyContentButton}
				{@render emptyContentButton()}
			{/if}
		</div>
	{:else}
		<Table
			data={filteredTableData}
			fields={['name', 'type', 'users', 'created', 'registry']}
			filterable={['name', 'type', 'registry']}
			onSelectRow={(d, isCtrlClick) => {
				let url = '';
				if (d.type === 'single' || d.type === 'remote') {
					url = d.data.powerUserWorkspaceID
						? `/admin/mcp-servers/w/${d.data.powerUserWorkspaceID}/c/${d.id}`
						: `/admin/mcp-servers/c/${d.id}`;
				} else {
					url = d.data.powerUserWorkspaceID
						? `/admin/mcp-servers/w/${d.data.powerUserWorkspaceID}/s/${d.id}`
						: `/admin/mcp-servers/s/${d.id}`;
				}
				openUrl(url, isCtrlClick);
			}}
			sortable={['name', 'type', 'users', 'created', 'registry']}
			noDataMessage="No catalog servers added."
		>
			{#snippet onRenderColumn(property, d)}
				{#if property === 'name'}
					<div class="flex flex-shrink-0 items-center gap-2">
						<div
							class="bg-surface1 flex items-center justify-center rounded-sm p-0.5 dark:bg-gray-600"
						>
							{#if d.icon}
								<img src={d.icon} alt={d.name} class="size-6" />
							{:else}
								<Server class="size-6" />
							{/if}
						</div>
						<p class="flex items-center gap-1">
							{d.name}
						</p>
					</div>
				{:else if property === 'type'}
					{d.type === 'single' ? 'Single User' : d.type === 'multi' ? 'Multi-User' : 'Remote'}
				{:else if property === 'created'}
					{formatTimeAgo(d.created).relativeTime}
				{:else}
					{d[property as keyof typeof d]}
				{/if}
			{/snippet}
			{#snippet actions(d)}
				{#if d.editable && !readonly}
					<button
						class="icon-button hover:text-red-500"
						onclick={(e) => {
							e.stopPropagation();
							if (d.data.type === 'mcpserver') {
								deletingServer = d.data as MCPCatalogServer;
							} else {
								deletingEntry = d.data as MCPCatalogEntry;
							}
						}}
						use:tooltip={'Delete Entry'}
					>
						<Trash2 class="size-4" />
					</button>
				{/if}
				<button class="icon-button hover:text-blue-500" use:tooltip={'View Entry'}>
					<Eye class="size-4" />
				</button>
			{/snippet}
		</Table>
	{/if}
</div>

{#if catalog?.sourceURLs && catalog.sourceURLs.length > 0 && catalog.id}
	<div class="flex flex-col gap-2" in:slide={{ axis: 'y' }}>
		<h2 class="mb-2 flex items-center gap-2 text-lg font-semibold">
			Global Registry Git Source URLs
			{#if !readonly}
				<button class="button-small flex items-center gap-1 text-xs font-normal" onclick={onSync}>
					{#if syncing}
						<LoaderCircle class="size-4 animate-spin" /> Syncing...
					{:else}
						<RefreshCcw class="size-4" />
						Sync
					{/if}
				</button>
			{/if}
		</h2>

		<Table
			data={catalog?.sourceURLs?.map((url, index) => ({ id: index, url })) ?? []}
			fields={['url']}
			headers={[
				{
					property: 'url',
					title: 'URL'
				}
			]}
			noDataMessage="No Git Source URLs added."
			setRowClasses={(d) => {
				if (catalog?.syncErrors?.[d.url]) {
					return 'bg-yellow-500/10';
				}
				return '';
			}}
		>
			{#snippet actions(d)}
				{#if !readonly}
					<button
						class="icon-button hover:text-red-500"
						onclick={() => {
							deletingSource = d.url;
						}}
					>
						<Trash2 class="size-4" />
					</button>
				{/if}
			{/snippet}
			{#snippet onRenderColumn(property, d)}
				{#if property === 'url'}
					<div class="flex items-center gap-2">
						<p>{d.url}</p>
						{#if catalog?.syncErrors?.[d.url]}
							<button
								onclick={() => {
									syncError = {
										url: d.url,
										error: catalog?.syncErrors?.[d.url] ?? ''
									};
									syncErrorDialog?.open();
								}}
								use:tooltip={{
									text: 'An issue occurred. Click to see more details.',
									classes: ['break-words']
								}}
							>
								<TriangleAlert class="size-4 text-yellow-500" />
							</button>
						{/if}
					</div>
				{/if}
			{/snippet}
		</Table>
	</div>
{/if}

<Confirm
	msg="Are you sure you want to delete this server?"
	show={Boolean(deletingEntry)}
	onsuccess={async () => {
		if (!deletingEntry || !catalog) {
			return;
		}

		await AdminService.deleteMCPCatalogEntry(catalog.id, deletingEntry.id);
		await fetchMcpServerAndEntries(catalog.id, mcpServerAndEntries);
		deletingEntry = undefined;
	}}
	oncancel={() => (deletingEntry = undefined)}
/>

<Confirm
	msg="Are you sure you want to delete this server?"
	show={Boolean(deletingServer)}
	onsuccess={async () => {
		if (!deletingServer || !catalog) {
			return;
		}

		await AdminService.deleteMCPCatalogServer(catalog.id, deletingServer.id);
		await fetchMcpServerAndEntries(catalog.id, mcpServerAndEntries);
		deletingServer = undefined;
	}}
	oncancel={() => (deletingServer = undefined)}
/>

<Confirm
	msg="Are you sure you want to delete this Git Source URL?"
	show={Boolean(deletingSource)}
	onsuccess={async () => {
		if (!deletingSource || !catalog) {
			return;
		}

		const response = await AdminService.updateMCPCatalog(catalog.id, {
			...catalog,
			sourceURLs: catalog.sourceURLs?.filter((url) => url !== deletingSource)
		});
		await onSync?.();
		catalog = response;
		deletingSource = undefined;
	}}
	oncancel={() => (deletingSource = undefined)}
/>

<ResponsiveDialog title="Git Source URL Sync" bind:this={syncErrorDialog} class="md:w-2xl">
	<div class="mb-4 flex flex-col gap-4">
		<div class="notification-alert flex flex-col gap-2">
			<div class="flex items-center gap-2">
				<AlertTriangle class="size-6 flex-shrink-0 self-start text-yellow-500" />
				<p class="my-0.5 flex flex-col text-sm font-semibold">
					An issue occurred fetching this source URL:
				</p>
			</div>
			<span class="text-sm font-light break-all">{syncError?.error}</span>
		</div>
	</div>
</ResponsiveDialog>
