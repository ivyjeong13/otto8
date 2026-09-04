<script lang="ts">
	import { page } from '$app/state';
	import Layout from '$lib/components/Layout.svelte';
	import ConnectToServer from '$lib/components/mcp/ConnectToServer.svelte';
	import IconButton from '$lib/components/primitives/IconButton.svelte';
	import CreateEditVMcp from '$lib/components/vmcps/CreateEditVMcp.svelte';
	import CreateVMcpButton from '$lib/components/vmcps/CreateVMcpButton.svelte';
	import McpServersSidebar from '$lib/components/vmcps/McpServersSidebar.svelte';
	import VMcpDragHint from '$lib/components/vmcps/VMcpDragHint.svelte';
	import VMcpDragOverlay from '$lib/components/vmcps/VMcpDragOverlay.svelte';
	import VMcpGraph from '$lib/components/vmcps/VMcpGraph.svelte';
	import VMcpGraphRow from '$lib/components/vmcps/VMcpGraphRow.svelte';
	import VMcpProfiles from '$lib/components/vmcps/VMcpProfiles.svelte';
	import VMcpToolDialogs from '$lib/components/vmcps/VMcpToolDialogs.svelte';
	import ViewModifyCatalogEntry from '$lib/components/vmcps/ViewModifyCatalogEntry.svelte';
	import { DEFAULT_MCP_CATALOG_ID } from '$lib/constants';
	import { CREATE_VMCP_DROP_ID, createEntryDrag } from '$lib/runes/vmcps/entryDrag.svelte';
	import {
		claimToolSetupForVMcp,
		createVMcpToolFlow,
		queueToolSetupForCreatedVMcp
	} from '$lib/runes/vmcps/vmcpToolFlow.svelte';
	import {
		AdminService,
		Group,
		type CatalogComponentServer,
		type MCPCatalogEntry,
		type MCPServerInstance
	} from '$lib/services';
	import { isMultiUserCatalogEntry, isMultiUserServer } from '$lib/services/user/mcp';
	import { vmcpRowHeight } from '$lib/services/vmcps/camera';
	import { SHORT_DESCRIPTION_MAX_LENGTH } from '$lib/services/vmcps/constants';
	import { appendComponentLabel, resolveVMcpComponents } from '$lib/services/vmcps/utils';
	import { errors, mcpServersAndEntries, profile } from '$lib/stores';
	import { success } from '$lib/stores/success';
	import { goto, setUrlParamAndUpdateUrl } from '$lib/url';
	import { Trash2 } from '@lucide/svelte';
	import { untrack } from 'svelte';
	import { twMerge } from 'tailwind-merge';

	interface Props {
		vmcp?: MCPCatalogEntry;
		onBack?: () => void;
	}

	let { vmcp, onBack }: Props = $props();

	let viewType = $state<'graph' | 'profiles'>('graph');
	let showRightPanel = $state(true);
	let createEditVMcp = $state<ReturnType<typeof CreateEditVMcp>>();
	let catalogEntryDialog = $state<ReturnType<typeof ViewModifyCatalogEntry>>();
	let connectToServerDialog = $state<ReturnType<typeof ConnectToServer>>();
	let rightPanelEl = $state<HTMLElement>();
	let graphCanvasEl = $state<HTMLElement>();
	let rightPanelWidth = $state(0);
	let pendingEntryDrop = $state<{ vmcp?: MCPCatalogEntry }>();
	let expanded = $state(true);
	const toolFlow = createVMcpToolFlow();

	let query = $derived(page.url.searchParams.get('query') ?? '');
	let vmcpId = $derived(vmcp?.id);
	let selectedVMcp = $derived(
		vmcpId
			? (mcpServersAndEntries.current.entries.find((entry) => entry.id === vmcpId) ?? vmcp)
			: undefined
	);
	let composites = $derived(selectedVMcp ? [selectedVMcp] : []);
	let title = $derived(selectedVMcp?.manifest.name ?? 'Create vMCP');
	let canCreateCatalogEntry = $derived(
		profile.current.isAdmin?.() || profile.current.groups.includes(Group.POWERUSER)
	);

	$effect(() => {
		if (!vmcp) return;
		const entries = mcpServersAndEntries.current.entries;
		if (entries.some((entry) => entry.id === vmcp.id)) return;
		mcpServersAndEntries.current.entries = [...entries, vmcp];
	});

	// Picks up the flow the create page handed over. Waits for the servers store so the first
	// component resolves to its catalog entry rather than falling back to a bare setup dialog.
	$effect(() => {
		const created = selectedVMcp;
		if (!created || mcpServersAndEntries.current.loading) return;

		untrack(() => {
			if (!claimToolSetupForVMcp(created.id)) return;
			toolFlow.handleVMcpCreated(created);
		});
	});

	function catalogEntryForComponent(component: CatalogComponentServer) {
		if (component.catalogEntryID) {
			return mcpServersAndEntries.current.entries.find(
				(entry) => entry.id === component.catalogEntryID
			);
		}

		if (!component.mcpServerID) return undefined;

		const server = mcpServersAndEntries.current.servers.find(
			(candidate) => candidate.id === component.mcpServerID
		);
		if (!server?.catalogEntryID) return undefined;

		return mcpServersAndEntries.current.entries.find((entry) => entry.id === server.catalogEntryID);
	}

	function componentManifestField(
		component: CatalogComponentServer,
		field: 'name' | 'shortDescription'
	) {
		const entry = catalogEntryForComponent(component);
		const server = component.mcpServerID
			? mcpServersAndEntries.current.servers.find(
					(candidate) => candidate.id === component.mcpServerID
				)
			: undefined;
		const manifest = component.manifest ?? entry?.manifest ?? server?.manifest;
		return manifest?.[field];
	}

	const entryDrag = createEntryDrag({
		composites: () => composites,
		panelEl: () => rightPanelEl,
		canvasEl: () => graphCanvasEl,
		canvasDropId: () => selectedVMcp?.id ?? CREATE_VMCP_DROP_ID,
		openEntry: (entry) => openCatalogEntry(entry),
		createEntry: (target) => startCatalogEntryCreation(target),
		dropOnCreate: (entry) => handleDroppedOnCreate(entry),
		dropOnVMcp: (entry, target) => void handleDropped(entry, target)
	});

	$effect(() => {
		const el = rightPanelEl;
		if (!el) return;

		const observer = new ResizeObserver(() => {
			rightPanelWidth = el.getBoundingClientRect().width;
		});
		observer.observe(el);
		return () => observer.disconnect();
	});

	function openCatalogEntry(entry: MCPCatalogEntry) {
		void catalogEntryDialog?.open(entry);
	}

	function startCatalogEntryCreation(target?: { vmcp?: MCPCatalogEntry }) {
		pendingEntryDrop = target;
		catalogEntryDialog?.start(target ? { closeAfterCreate: true } : undefined);
	}

	async function handleCatalogEntryCreated(created: MCPCatalogEntry) {
		const pending = pendingEntryDrop;
		pendingEntryDrop = undefined;
		if (!pending) return;

		if (pending.vmcp) {
			await handleDropped(created, pending.vmcp);
			return;
		}

		handleDroppedOnCreate(created);
	}

	function toComponentServer(entry: MCPCatalogEntry): CatalogComponentServer | undefined {
		if (!isMultiUserCatalogEntry(entry)) {
			return { catalogEntryID: entry.id, manifest: entry.manifest };
		}

		const deployed = mcpServersAndEntries.current.servers.find(
			(server) => isMultiUserServer(server) && server.catalogEntryID === entry.id
		);
		return deployed ? { mcpServerID: deployed.id } : undefined;
	}

	function handleDroppedOnCreate(entry: MCPCatalogEntry) {
		const component = toComponentServer(entry);
		if (!component) {
			errors.append(
				`${entry.manifest.name} is a multi-user server and must be deployed before it can be added to a vMCP.`
			);
			return;
		}

		createEditVMcp?.openCreate([{ ...component, manifest: component.manifest ?? entry.manifest }]);
	}

	async function handleDropped(entry: MCPCatalogEntry, target: MCPCatalogEntry) {
		const component = toComponentServer(entry);
		if (!component) {
			errors.append(
				`${entry.manifest.name} is a multi-user server and must be deployed before it can be added to a vMCP.`
			);
			return;
		}

		try {
			const latest = await AdminService.getMCPCatalogEntry(DEFAULT_MCP_CATALOG_ID, target.id);
			const components = latest.manifest.compositeConfig?.componentServers ?? [];
			if (
				components.some(
					(existing) =>
						(component.catalogEntryID && existing.catalogEntryID === component.catalogEntryID) ||
						(component.mcpServerID && existing.mcpServerID === component.mcpServerID)
				)
			) {
				return;
			}

			const nextComponents = [...components, component];
			const updated = await AdminService.updateMCPCatalogEntry(DEFAULT_MCP_CATALOG_ID, target.id, {
				...latest.manifest,
				name:
					appendComponentLabel(
						latest.manifest.name,
						components.map((existing) => componentManifestField(existing, 'name')),
						entry.manifest.name
					) ?? latest.manifest.name,
				shortDescription:
					appendComponentLabel(
						latest.manifest.shortDescription,
						components.map((existing) => componentManifestField(existing, 'shortDescription')),
						entry.manifest.shortDescription,
						SHORT_DESCRIPTION_MAX_LENGTH
					) ?? latest.manifest.shortDescription,
				compositeConfig: {
					...latest.manifest.compositeConfig,
					componentServers: nextComponents
				}
			});

			mcpServersAndEntries.current.entries = mcpServersAndEntries.current.entries.map(
				(candidate) => (candidate.id === updated.id ? updated : candidate)
			);
			success.add(`${entry.manifest.name} added to ${updated.manifest.name}.`);

			toolFlow.offerToolSelection(entry, updated);
		} catch {
			errors.append('Failed to add MCP server to vMCP.');
		}
	}

	function handleVMcpCreated(created: MCPCatalogEntry) {
		// The navigation unmounts this designer, so the vMCP's own page opens the tool dialogs.
		queueToolSetupForCreatedVMcp(created.id);
		goto(`/vmcps/${created.id}`);
	}

	function vmcpComponents(target: MCPCatalogEntry) {
		const { entries, servers } = mcpServersAndEntries.current;
		return resolveVMcpComponents(target, entries, servers);
	}

	function handleConnectVMcp(target: MCPCatalogEntry) {
		connectToServerDialog?.open({ entry: target });
	}

	function handleConnectToServer({ instance }: { instance?: MCPServerInstance }) {
		if (instance) {
			mcpServersAndEntries.refreshUserInstances();
		} else {
			mcpServersAndEntries.refreshUserConfiguredServers();
		}
	}

	const updateSearchQuery = (value: string) => {
		setUrlParamAndUpdateUrl(page.url, 'query', value);
	};

	function handleBack() {
		onBack?.();
		if (!onBack) goto('/vmcps');
	}
</script>

<Layout
	classes={{
		container: 'p-0 md:px-0 min-h-0',
		childrenContainer: 'max-w-full',
		collapsedSidebarHeaderContent: 'p-4 pb-0'
	}}
	{title}
	showBackButton
	onBackButtonClick={handleBack}
>
	<div
		class="@container dark:from-base-300 to-base-200 relative h-full min-h-0 w-full overflow-hidden bg-radial-[at_50%_50%] from-gray-50 dark:to-black"
	>
		{@render toggleSubview()}
		{#if viewType === 'profiles'}
			<VMcpProfiles vmcp={selectedVMcp} {toolFlow} />
		{:else}
			<VMcpGraph
				bind:viewportEl={graphCanvasEl}
				item={selectedVMcp}
				{expanded}
				dragActive={entryDrag.active}
				estimateHeight={(item, expanded) => vmcpRowHeight(vmcpComponents(item).length, expanded)}
			>
				{#snippet row(item, ctx)}
					<VMcpGraphRow
						vmcp={item}
						components={vmcpComponents(item)}
						{expanded}
						context={ctx}
						drag={entryDrag}
						onToggleExpand={() => (expanded = !expanded)}
						onEdit={() => createEditVMcp?.openEdit(item)}
						onConnect={() => handleConnectVMcp(item)}
						onDelete={() => createEditVMcp?.openDelete(item)}
						onModifyComponent={(component) => toolFlow.openComponent(component, item)}
					/>
				{/snippet}
				{#snippet empty()}
					<CreateVMcpButton drag={entryDrag} onCreate={() => createEditVMcp?.openCreate()} />
				{/snippet}
				{#snippet actions()}
					{#if selectedVMcp}
						<IconButton
							class="btn-sm"
							variant="danger"
							tooltip={{ text: 'Delete vMCP', placement: 'bottom' }}
							onclick={() => {
								if (!selectedVMcp) return;
								createEditVMcp?.openDelete(selectedVMcp);
							}}
						>
							<Trash2 class="size-4" />
						</IconButton>
					{/if}
				{/snippet}
			</VMcpGraph>
			{#if showRightPanel}
				<VMcpDragHint
					dragActive={entryDrag.active}
					class="absolute top-1/2 right-4 z-20 hidden -translate-y-1/2 @2xl:block"
				/>
			{/if}
		{/if}
	</div>
	{#snippet rightSidebar()}
		<McpServersSidebar
			bind:panelEl={rightPanelEl}
			bind:open={showRightPanel}
			drag={entryDrag}
			{query}
			onSearch={updateSearchQuery}
			canCreateEntry={canCreateCatalogEntry}
		/>
	{/snippet}
</Layout>

{#snippet toggleSubview()}
	<div class="p-2 w-fit">
		<div class="tabs tabs-box bg-base-300 shadow-inner dark:bg-base-100">
			<button
				class={twMerge(
					'tab text-xs min-w-24',
					viewType === 'graph' && 'tab-active dark:bg-base-300/80'
				)}
				onclick={() => (viewType = 'graph')}>Designer</button
			>
			<button
				class={twMerge(
					'tab text-xs min-w-24',
					viewType === 'profiles' && 'tab-active dark:bg-base-300/80'
				)}
				onclick={() => (viewType = 'profiles')}>Profiles</button
			>
		</div>
	</div>
{/snippet}

<VMcpDragOverlay drag={entryDrag} />

<VMcpToolDialogs flow={toolFlow} />

<ConnectToServer
	bind:this={connectToServerDialog}
	catalogID={DEFAULT_MCP_CATALOG_ID}
	onConnect={handleConnectToServer}
/>

<CreateEditVMcp bind:this={createEditVMcp} onCreated={handleVMcpCreated} onDeleted={handleBack} />

<ViewModifyCatalogEntry
	bind:this={catalogEntryDialog}
	rightOffsetWidth={rightPanelWidth}
	onCreated={handleCatalogEntryCreated}
/>

<svelte:head>
	<title>Obot | {title}</title>
</svelte:head>
