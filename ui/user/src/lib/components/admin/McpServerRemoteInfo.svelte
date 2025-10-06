<script lang="ts">
	import { page } from '$app/state';
	import { ChatService, type MCPCatalogServer, type OrgUser } from '$lib/services';
	import { profile } from '$lib/stores';
	import { twMerge } from 'tailwind-merge';
	import Table from '../table/Table.svelte';
	import { onMount } from 'svelte';

	interface Props {
		entity?: 'workspace' | 'catalog';
		entityId?: string;
		catalogEntryId?: string;
		mcpServerId?: string;
		mcpServerInstanceId?: string;
		classes?: {
			title?: string;
		};
		name: string;
		connectedUsers: OrgUser[];
	}

	let {
		name,
		connectedUsers,
		classes,
		entity,
		entityId,
		catalogEntryId,
		mcpServerId,
		mcpServerInstanceId
	}: Props = $props();
	let isAdminUrl = $derived(page.url.pathname.includes('/admin'));
	let mcpServer = $state<MCPCatalogServer>();
	let revealedInfo = $state<Record<string, string>>({});
	let headers = $derived(
		(mcpServer?.manifest.remoteConfig?.headers ?? []).map((h) => {
			const value = revealedInfo[h.key];
			return {
				...h,
				value
			};
		})
	);

	onMount(async () => {
		if (!mcpServerId || !catalogEntryId || !entityId) return;
		if (entity === 'catalog') {
			mcpServer = await ChatService.getSingleOrRemoteMcpServer(mcpServerId);
		} else if (entity === 'workspace') {
			mcpServer = await ChatService.getWorkspaceCatalogEntryServer(
				entityId,
				catalogEntryId,
				mcpServerId
			);
		}

		console.log(mcpServer);

		revealedInfo = await ChatService.revealSingleOrRemoteMcpServer(mcpServerId, {
			dontLogErrors: true
		});
	});
</script>

<div class="flex items-center gap-3">
	<h1 class={twMerge('text-2xl font-semibold', classes?.title)}>
		{name}
	</h1>
</div>

<div>
	<div class="flex flex-col gap-8">
		{@render status('URL', mcpServer?.manifest.remoteConfig?.url)}
		<div class="flex flex-col gap-2">
			<h2 class="mb-2 text-lg font-semibold">Headers</h2>
			{#if headers.length > 0}
				{#each headers as h}
					{@render status(h.key, h.value)}
				{/each}
			{:else}
				<span class="text-sm font-light text-gray-400 dark:text-gray-600"
					>No configured headers.</span
				>
			{/if}
		</div>
	</div>
</div>

<div>
	<h2 class="mb-2 text-lg font-semibold">Connected Users</h2>

	<!-- show connected URL, configuration settings -->
	<Table data={connectedUsers} fields={['name']}>
		{#snippet onRenderColumn(property: string, d: OrgUser)}
			{#if property === 'name'}
				{d.email || d.username || 'Unknown'}
			{:else}
				{d[property as keyof typeof d]}
			{/if}
		{/snippet}

		{#snippet actions(d)}
			{#if profile.current?.isAdmin?.() && isAdminUrl}
				{@const mcpId = mcpServerId || mcpServerInstanceId}
				{@const id = mcpId?.split('-').at(-1)}
				{@const url =
					entity === 'workspace'
						? catalogEntryId
							? `/admin/mcp-servers/w/${entityId}/c/${catalogEntryId}?view=audit-logs&userId=${d.id}`
							: `/admin/mcp-servers/w/${entityId}/s/${encodeURIComponent(id ?? '')}?view=audit-logs&userId=${d.id}`
						: `/admin/mcp-servers/s/${encodeURIComponent(id ?? '')}?view=audit-logs&userId=${d.id}`}
				<a href={url} class="button-text"> View Audit Logs </a>
			{/if}
		{/snippet}
	</Table>
</div>

{#snippet status(title: string, value?: string)}
	<div
		class="dark:bg-surface1 dark:border-surface3 flex flex-col rounded-lg border border-transparent bg-white p-4 shadow-sm"
	>
		<div class="grid grid-cols-12 gap-4">
			<p class="col-span-4 text-sm font-semibold">{title}</p>
			<div class="col-span-8 flex items-center justify-between">
				<p class="truncate text-sm font-light">{value || 'N/A'}</p>
			</div>
		</div>
	</div>
{/snippet}
