<script lang="ts">
	import { tooltip } from '$lib/actions/tooltip.svelte';
	import DiffDialog from '$lib/components/admin/DiffDialog.svelte';
	import Confirm from '$lib/components/Confirm.svelte';
	import DotDotDot from '$lib/components/DotDotDot.svelte';
	import Search from '$lib/components/Search.svelte';
	import Table from '$lib/components/table/Table.svelte';
	import { ADMIN_SESSION_STORAGE } from '$lib/constants';
	import { getAdminMcpServerAndEntries } from '$lib/context/admin/mcpServerAndEntries.svelte';
	import {
		AdminService,
		ChatService,
		type MCPCatalogEntry,
		type MCPCatalogServer,
		type MCPServerInstance,
		type OrgUser
	} from '$lib/services';
	import { formatTimeAgo } from '$lib/time';
	import { getUserDisplayName, openUrl } from '$lib/utils';
	import {
		CircleAlert,
		Ellipsis,
		GitCompare,
		LoaderCircle,
		Power,
		Server,
		ServerCog,
		Square,
		SquareCheck
	} from 'lucide-svelte';
	import { onMount } from 'svelte';
	import { slide } from 'svelte/transition';

	interface Props {
		usersMap?: Map<string, OrgUser>;
		catalogId: string;
		readonly?: boolean;
	}

	let { usersMap = new Map(), catalogId, readonly }: Props = $props();
	let search = $state('');
	let loading = $state(false);

	let diffDialog = $state<ReturnType<typeof DiffDialog>>();
	let existingServer = $state<MCPCatalogServer>();
	let updatedServer = $state<MCPCatalogServer | MCPCatalogEntry>();

	let showConfirm = $state<
		{ type: 'multi' } | { type: 'single'; server: MCPCatalogServer } | undefined
	>();
	let selected = $state<Record<string, MCPCatalogServer>>({});
	let updating = $state<Record<string, { inProgress: boolean; error: string }>>({});
	let bulkRestarting = $state(false);

	let serversData = $state<MCPCatalogServer[]>([]);
	let instancesData = $state<MCPServerInstance[]>([]);
	let mcpServerAndEntries = getAdminMcpServerAndEntries();

	let hasSelected = $derived(Object.values(selected).some((v) => v));
	let tableData = $derived.by(() => {
		const instancesMap = instancesData.reduce<Record<string, MCPServerInstance[]>>(
			(acc, instance) => {
				if (instance.mcpServerID && !acc[instance.mcpServerID]) {
					acc[instance.mcpServerID] = [];
				}
				if (instance.mcpServerID) {
					acc[instance.mcpServerID].push(instance);
				}
				return acc;
			},
			{}
		);
		const entriesMap = mcpServerAndEntries.entries.reduce<Record<string, MCPCatalogEntry>>(
			(acc, entry) => {
				acc[entry.id] = entry;
				return acc;
			},
			{}
		);
		return serversData.map((deployment) => {
			const powerUserWorkspaceID =
				deployment.powerUserWorkspaceID ||
				(deployment.catalogEntryID
					? entriesMap[deployment.catalogEntryID]?.powerUserWorkspaceID
					: undefined);
			const powerUserID = deployment.catalogEntryID
				? entriesMap[deployment.catalogEntryID]?.powerUserID
				: undefined;
			return {
				...deployment,
				displayName: deployment.manifest.name ?? '',
				userName: getUserDisplayName(usersMap, deployment.userID),
				registry: powerUserID ? getUserDisplayName(usersMap, powerUserID) : 'Global Registry',
				type:
					deployment.manifest.runtime === 'remote'
						? 'Remote'
						: deployment.catalogEntryID
							? 'Single User'
							: 'Multi-User',
				instances:
					instancesMap[deployment.id]?.map((instance) => ({
						...instance,
						userName: getUserDisplayName(usersMap, instance.userID)
					})) ?? [],
				powerUserWorkspaceID
			};
		});
	});

	onMount(async () => {
		loading = true;
		const deployedCatalogEntryServers =
			await AdminService.listAllCatalogDeployedSingleRemoteServers(catalogId);
		const deployedWorkspaceCatalogEntryServers =
			await AdminService.listAllWorkspaceDeployedSingleRemoteServers();
		const deployedCatalogMultiUserInstances =
			await AdminService.listAllCatalogDeployedMultiUserInstances(catalogId);
		const deployedWorkspaceMultiUserInstances =
			await AdminService.listAllWorkspaceDeployedMultiUserInstances();

		serversData = [
			...deployedCatalogEntryServers,
			...deployedWorkspaceCatalogEntryServers,
			...mcpServerAndEntries.servers
		];

		instancesData = [...deployedCatalogMultiUserInstances, ...deployedWorkspaceMultiUserInstances];
		loading = false;
	});

	async function handleMultiUpdate() {
		for (const id of Object.keys(selected)) {
			updating[id] = { inProgress: true, error: '' };
			try {
				await ChatService.triggerMcpServerUpdate(id);
				updating[id] = { inProgress: false, error: '' };
			} catch (error) {
				updating[id] = {
					inProgress: false,
					error: error instanceof Error ? error.message : 'An unknown error occurred'
				};
			} finally {
				delete updating[id];
			}
		}

		selected = {};
		// data = await fetchDeployedCatalogEntryServers();
	}

	async function updateServer(server?: MCPCatalogServer) {
		if (!server) return;
		updating[server.id] = { inProgress: true, error: '' };
		try {
			await ChatService.triggerMcpServerUpdate(server.id);
			// data = await fetchDeployedCatalogEntryServers();
		} catch (err) {
			updating[server.id] = {
				inProgress: false,
				error: err instanceof Error ? err.message : 'An unknown error occurred'
			};
		}

		delete updating[server.id];
	}

	function setLastVisitedMcpServer(item: (typeof tableData)[0]) {
		if (!item) return;
		const belongsToWorkspace = item.powerUserWorkspaceID ? true : false;
		sessionStorage.setItem(
			ADMIN_SESSION_STORAGE.LAST_VISITED_MCP_SERVER,
			JSON.stringify({
				id: item.id,
				name: item.manifest?.name,
				type:
					item.manifest?.runtime === 'remote' ? 'remote' : item.catalogEntryID ? 'single' : 'multi',
				entity: belongsToWorkspace ? 'workspace' : 'catalog',
				entityId: belongsToWorkspace ? item.powerUserWorkspaceID : catalogId
			})
		);
	}
</script>

<div class="flex flex-col gap-2">
	<Search
		class="dark:bg-surface1 dark:border-surface3 border border-transparent bg-white shadow-sm"
		onChange={(val) => (search = val)}
		placeholder="Search servers..."
	/>

	{#if loading || mcpServerAndEntries.loading}
		<div class="my-2 flex items-center justify-center">
			<LoaderCircle class="size-6 animate-spin" />
		</div>
	{:else if serversData.length === 0}
		<div class="mt-12 flex w-md flex-col items-center gap-4 self-center text-center">
			<Server class="size-24 text-gray-200 dark:text-gray-900" />
			<h4 class="text-lg font-semibold text-gray-400 dark:text-gray-600">
				No current deployments.
			</h4>
			<p class="text-sm font-light text-gray-400 dark:text-gray-600">
				Once a server has been deployed, its <br />
				information will be quickly accessible here.
			</p>
		</div>
	{:else}
		<Table
			data={tableData}
			fields={[
				'checkbox',
				'displayName',
				'type',
				'deploymentStatus',
				'userName',
				'registry',
				'created'
			]}
			filterable={['displayName', 'type', 'deploymentStatus', 'userName', 'registry']}
			headers={[
				{ title: 'Name', property: 'displayName' },
				{ title: 'User', property: 'userName' },
				{ title: 'Status', property: 'deploymentStatus' },
				{ title: '', property: 'checkbox' }
			]}
			headerClasses={[{ property: 'checkbox', class: 'w-4' }]}
			onSelectRow={(d, isCtrlClick) => {
				const isRemote = d.manifest?.runtime === 'remote';
				const isMulti = !d.catalogEntryID;
				setLastVisitedMcpServer(d);

				const belongsToWorkspace = d.powerUserWorkspaceID ? true : false;

				let url = '';
				if (isMulti) {
					url = belongsToWorkspace
						? `/admin/mcp-servers/w/${d.powerUserWorkspaceID}/s/${d.id}/details`
						: `/admin/mcp-servers/s/${d.id}/details`;
				} else {
					url = belongsToWorkspace
						? `/admin/mcp-servers/w/${d.powerUserWorkspaceID}/c/${d.catalogEntryID}/instance/${d.id}?from=deployed-servers`
						: `/admin/mcp-servers/c/${d.catalogEntryID}/instance/${d.id}?from=deployed-servers`;
				}
				openUrl(url, isCtrlClick);
			}}
			sortable={['displayName', 'type', 'deploymentStatus', 'userName', 'registry', 'created']}
			noDataMessage="No catalog servers added."
		>
			{#snippet onRenderColumn(property, d)}
				{#if property === 'checkbox'}
					<button
						class="icon-button hover:bg-black/50"
						onclick={(e) => {
							e.stopPropagation();
							if (selected[d.id]) {
								delete selected[d.id];
							} else {
								selected[d.id] = d;
							}
						}}
						disabled={readonly}
					>
						{#if selected[d.id]}
							<SquareCheck class="size-5" />
						{:else}
							<Square class="size-5" />
						{/if}
					</button>
				{:else if property === 'displayName'}
					<div class="flex flex-shrink-0 items-center gap-2">
						<div
							class="bg-surface1 flex items-center justify-center rounded-sm p-0.5 dark:bg-gray-600"
						>
							{#if d.manifest.icon}
								<img src={d.manifest.icon} alt={d.manifest.name} class="size-6" />
							{:else}
								<Server class="size-6" />
							{/if}
						</div>
						<p class="flex items-center gap-1">
							{d.displayName}
						</p>
					</div>
				{:else if property === 'created'}
					{formatTimeAgo(d.created).relativeTime}
				{:else}
					{d[property as keyof typeof d]}
				{/if}
			{/snippet}
			{#snippet actions(d)}
				<DotDotDot class="icon-button hover:dark:bg-black/50">
					{#snippet icon()}
						<Ellipsis class="size-4" />
					{/snippet}

					<div class="default-dialog flex min-w-max flex-col gap-1 p-2">
						{#if d.needsUpdate}
							<button
								class="menu-button bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20"
								disabled={updating[d.id]?.inProgress || readonly}
								onclick={async (e) => {
									e.stopPropagation();
									if (!d) return;
									showConfirm = {
										type: 'single',
										server: d
									};
								}}
							>
								{#if updating[d.id]?.inProgress}
									<LoaderCircle class="size-4 animate-spin" />
								{:else}
									<ServerCog class="size-4" />
								{/if}
								Update Server
							</button>
							<button
								class="menu-button"
								onclick={(e) => {
									e.stopPropagation();
									existingServer = d;
									// updatedServer = parent;
									diffDialog?.open();
								}}
							>
								<GitCompare class="size-4" /> View Diff
							</button>
						{/if}
						<button
							class="menu-button"
							onclick={(e) => {
								e.stopPropagation();
								if (d.powerUserWorkspaceID) {
									ChatService.restartWorkspaceK8sServerDeployment(d.powerUserWorkspaceID, d.id);
								} else {
									AdminService.restartK8sDeployment(d.id);
								}
							}}
						>
							<Power class="size-4" /> Restart Server
						</button>
					</div>
				</DotDotDot>
			{/snippet}
			{#snippet onRenderSubrowContent(d)}
				{#if d.instances.length > 0}
					<div class="bg-surface1/50 dark:bg-surface3/50 w-full shadow-inner">
						{#each d.instances as instance}
							<div class="flex items-center gap-4 text-sm font-light">
								<div
									class="max-w-[72px] px-4 py-2"
									use:tooltip={'Cannot perform bulk actions on Multi-user connections. Select the Multi-user Server instead.'}
								>
									<button
										disabled
										class="icon-button flex-shrink-0 cursor-not-allowed text-gray-600"
									>
										<Square class="size-5" />
									</button>
								</div>
								<div class="flex grow items-center justify-between">
									<div>
										{instance.userName}
									</div>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			{/snippet}
		</Table>
	{/if}
</div>

{#if hasSelected}
	{@const numSelected = Object.keys(selected).length}
	{@const canBulkUpdate = Object.values(selected).every((s) => s.needsUpdate)}
	{@const updatingInProgress = Object.values(updating).some((u) => u.inProgress)}
	<div
		class="bg-surface1 sticky bottom-0 left-0 mt-auto flex w-[calc(100%+2em)] -translate-x-4 justify-end gap-4 p-4 md:w-[calc(100%+4em)] md:-translate-x-8 md:px-8 dark:bg-black"
	>
		<div class="flex w-full items-center justify-between">
			<p class="text-sm font-medium">
				{numSelected} server instance{numSelected === 1 ? '' : 's'} selected
			</p>
			<div class="flex items-center gap-4">
				<button
					class="button flex items-center gap-1"
					onclick={() => {
						selected = {};
						updating = {};
					}}
				>
					Cancel
				</button>
				<button
					class="button-primary flex items-center gap-1"
					onclick={() => {
						// TODO: bulk reload servers
					}}
					disabled={bulkRestarting}
				>
					{#if bulkRestarting}
						<LoaderCircle class="size-5" />
					{:else}
						Restart All
					{/if}
				</button>
				{#if canBulkUpdate}
					<button
						class="button-primary flex items-center gap-1 text-nowrap"
						onclick={() => {
							showConfirm = {
								type: 'multi'
							};
						}}
						transition:slide={{ axis: 'x', duration: 100 }}
						disabled={updatingInProgress || readonly}
					>
						{#if updatingInProgress}
							<LoaderCircle class="size-5" />
						{:else}
							Update All
						{/if}
					</button>
				{/if}
			</div>
		</div>
	</div>
{/if}

<DiffDialog bind:this={diffDialog} fromServer={existingServer} toServer={updatedServer} />

<Confirm
	show={!!showConfirm}
	onsuccess={async () => {
		if (!showConfirm) return;
		if (showConfirm.type === 'single') {
			await updateServer(showConfirm.server);
		} else {
			await handleMultiUpdate();
		}
		showConfirm = undefined;
	}}
	oncancel={() => (showConfirm = undefined)}
	classes={{
		confirm: 'bg-blue-500 hover:bg-blue-400 transition-colors duration-200'
	}}
>
	{#snippet title()}
		<h4 class="mb-4 flex items-center justify-center gap-2 text-lg font-semibold">
			<CircleAlert class="size-5" />
			{`Update ${showConfirm?.type === 'single' ? showConfirm.server.id : 'selected server(s)'}?`}
		</h4>
	{/snippet}
	{#snippet note()}
		<p class="mb-8 text-sm font-light">
			If this update introduces new required configuration parameters, users will have to supply
			them before they can use {showConfirm?.type === 'multi' ? 'these servers' : 'this server'} again.
		</p>
	{/snippet}
</Confirm>
