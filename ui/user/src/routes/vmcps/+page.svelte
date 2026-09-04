<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import Confirm from '$lib/components/Confirm.svelte';
	import CopyButton from '$lib/components/CopyButton.svelte';
	import CopyField from '$lib/components/CopyField.svelte';
	import ResponsiveDialog from '$lib/components/ResponsiveDialog.svelte';
	import Select from '$lib/components/Select.svelte';
	import SensitiveInput from '$lib/components/SensitiveInput.svelte';
	import TabLayout, { type TabView } from '$lib/components/TabLayout.svelte';
	import ConnectToServer from '$lib/components/mcp/ConnectToServer.svelte';
	import IconButton from '$lib/components/primitives/IconButton.svelte';
	import CreateEditVMcp from '$lib/components/vmcps/CreateEditVMcp.svelte';
	import VMcpDesigner from '$lib/components/vmcps/VMcpDesigner.svelte';
	import VMcpList from '$lib/components/vmcps/VMcpList.svelte';
	import VMcpListSettings from '$lib/components/vmcps/VMcpListSettings.svelte';
	import { DEFAULT_MCP_CATALOG_ID } from '$lib/constants';
	import { parseErrorContent } from '$lib/errors.js';
	import Loading from '$lib/icons/Loading.svelte';
	import {
		AdminService,
		UserService,
		type MCPCatalogEntry,
		type MCPServerInstance,
		type OrgUser
	} from '$lib/services';
	import type { GitCredential, VMcpRepository } from '$lib/services/admin/types';
	import { AiClient, COMMON_AI_CLIENTS } from '$lib/services/user/constants';
	import type { VMcpSortBy } from '$lib/services/vmcps/types';
	import {
		buildVMcpComponentFilterOptions,
		filterVMcps,
		isWorkspaceOwned,
		sortVMcps,
		resolveVMcpComponents,
		buildConnectAllSnippets
	} from '$lib/services/vmcps/utils';
	import { errors, mcpServersAndEntries, profile } from '$lib/stores';
	import { goto } from '$lib/url';
	import SourcesView from './SourcesView.svelte';
	import { Info, Layers, Plus, Settings, TriangleAlert, X } from '@lucide/svelte';
	import { onDestroy, onMount, untrack } from 'svelte';
	import { SvelteMap, SvelteSet } from 'svelte/reactivity';
	import { slide } from 'svelte/transition';
	import { twMerge } from 'tailwind-merge';

	type RepositoryCredentialType = 'none' | 'shared' | 'token';

	const repositoryCredentialOptions = [
		{ id: 'none', label: 'None' },
		{ id: 'shared', label: 'Choose existing' },
		{ id: 'token', label: 'Enter personal access token' }
	];

	let { data } = $props();
	let isAdminReadonly = $derived(Boolean(profile.current.isAdminReadonly?.()));
	let views = $derived.by((): TabView[] => [
		{ label: 'vMCPs', value: 'vmcps', content: vmcpsView },
		{ label: 'Sources', value: 'sources', content: sourcesView }
	]);

	const options = COMMON_AI_CLIENTS.slice(0, 4);

	let isLoading = $derived(mcpServersAndEntries.current.loading);
	let showAllConnectors = $state(false);
	let sortBy = $state<VMcpSortBy>('name');
	let nameFilterBy = $state('');
	let ownerFilterBy = $state('');
	let componentFilterBy = $state('');
	let allComposites = $derived(
		mcpServersAndEntries.current.entries.filter(
			(entry) =>
				entry.manifest.runtime === 'composite' && (showAllConnectors || !isWorkspaceOwned(entry))
		)
	);
	function componentFilterLabel(id: string) {
		const entry = mcpServersAndEntries.current.entries.find((candidate) => candidate.id === id);
		if (entry?.manifest.name) return entry.manifest.name;
		return mcpServersAndEntries.current.servers.find((candidate) => candidate.id === id)?.manifest
			.name;
	}
	let componentFilterOptions = $derived(
		buildVMcpComponentFilterOptions(allComposites, componentFilterLabel)
	);

	let createEditVMcp = $state<ReturnType<typeof CreateEditVMcp>>();
	let connectToServerDialog = $state<ReturnType<typeof ConnectToServer>>();
	let connectAllVMcpsDialog = $state<ReturnType<typeof ResponsiveDialog>>();
	let connectAllCopyField = $state<ReturnType<typeof CopyField>>();
	let selectedClient = $state<(typeof COMMON_AI_CLIENTS)[number]>();
	let isAdmin = $derived(!!profile.current.isAdmin?.());
	let connectAllVmcps = $derived(allComposites.filter((vmcp) => Boolean(vmcp.connectURL)));
	let connectAllSnippets = $derived(
		selectedClient ? buildConnectAllSnippets(selectedClient.id, connectAllVmcps, isAdmin) : []
	);
	let selectedConnectAllSnippetId = $state<string>();
	let selectedConnectAllSnippet = $derived(
		connectAllSnippets.find((snippet) => snippet.id === selectedConnectAllSnippetId) ??
			connectAllSnippets[0]
	);

	let users = $state<OrgUser[]>([]);
	let creating = $derived(page.url.searchParams.has('new'));
	let usersMap = $derived(new Map(users.map((user) => [user.id, user])));
	let composites = $derived(
		sortVMcps(
			filterVMcps(
				allComposites,
				{
					names: nameFilterBy,
					owners: ownerFilterBy,
					components: componentFilterBy
				},
				usersMap
			),
			sortBy
		)
	);

	let syncing = new SvelteSet<string>();
	let isSyncing = $derived(syncing.size > 0);
	let deleting = $state(false);
	let deletingSources = $state<VMcpRepository[] | undefined>();
	let vmcpRepositories = $state<VMcpRepository[]>(untrack(() => data?.vmcpRepositories ?? []));
	let gitCredentials = $state<GitCredential[]>(untrack(() => data?.gitCredentials ?? []));
	let sourceDialog = $state<HTMLDialogElement | undefined>(undefined);
	let syncErrorDialog = $state<ReturnType<typeof ResponsiveDialog>>();
	let syncError = $state<{ url: string; error: string }>();
	let syncInterval = new SvelteMap<string, ReturnType<typeof setInterval>>();
	let editingSource = $state<
		| {
				index: number;
				value: string;
				name: string;
				ref: string;
				token: string;
				gitCredentialID: string;
				credentialType: RepositoryCredentialType;
				repositoryID?: string;
				clearToken?: boolean;
		  }
		| undefined
	>(undefined);
	let sourceError = $state<string | undefined>(undefined);
	let saving = $state(false);
	let editingSourceHost = $derived(sourceHost(editingSource?.value ?? ''));
	let gitCredentialOptions = $derived(
		gitCredentials.map((credential) => ({
			id: credential.id,
			label: `${credential.displayName} (${credential.host})`,
			disabled:
				!credential.tokenConfigured ||
				Boolean(editingSourceHost && editingSourceHost !== credential.host.toLowerCase())
		}))
	);
	let editingVMcpRepository = $derived(
		editingSource?.repositoryID
			? vmcpRepositories.find((repository) => repository.id === editingSource?.repositoryID)
			: undefined
	);
	let existingVMcpRepositoryToken = $derived(
		editingSource?.value.trim() === editingVMcpRepository?.repoURL
			? (editingVMcpRepository?.sourceURLCredentials?.[editingVMcpRepository.repoURL] ?? '')
			: ''
	);
	let existingSourceHasCredential = $derived(
		Boolean(
			editingSource &&
			editingSource.index >= 0 &&
			(hasVMcpRepositoryToken(editingVMcpRepository) ||
				Boolean(editingVMcpRepository?.gitCredentialID))
		)
	);
	let credentialLocked = $derived(
		Boolean(editingSource && existingSourceHasCredential && !editingSource.clearToken)
	);
	let credentialSelectionIncomplete = $derived(
		Boolean(
			editingSource &&
			((editingSource.credentialType === 'shared' && !editingSource.gitCredentialID) ||
				(editingSource.credentialType === 'token' &&
					!editingSource.token.trim() &&
					(!hasVMcpRepositoryToken(editingVMcpRepository) ||
						editingSource.value.trim() !== editingVMcpRepository?.repoURL)))
		)
	);

	$effect(() => {
		vmcpRepositories = data?.vmcpRepositories ?? [];
	});

	$effect(() => {
		gitCredentials = data?.gitCredentials ?? [];
	});

	onMount(() => {
		UserService.listUsersIncludeDeleted().then((response) => {
			users = response;
		});
	});

	function sourceHost(value: string): string {
		try {
			return new URL(value.includes('://') ? value : `https://${value}`).host.toLowerCase();
		} catch {
			return '';
		}
	}

	function handleVMcpSourceURLInput() {
		if (!editingSource?.gitCredentialID) return;
		const selectedCredential = gitCredentials.find(
			(credential) => credential.id === editingSource?.gitCredentialID
		);
		const host = sourceHost(editingSource.value);
		if (selectedCredential && host && host !== selectedCredential.host.toLowerCase()) {
			editingSource.gitCredentialID = '';
		}
	}

	function hasVMcpRepositoryToken(repository: VMcpRepository | undefined): boolean {
		if (!repository) return false;
		const token = repository.sourceURLCredentials?.[repository.repoURL];
		return token !== undefined && token !== '';
	}

	function clearSyncInterval(id: string) {
		if (syncInterval.get(id)) {
			clearInterval(syncInterval.get(id));
			syncInterval.delete(id);
		}
	}

	function pollTillSyncComplete(id: string) {
		if (syncInterval.get(id)) {
			clearInterval(syncInterval.get(id));
		}

		syncInterval.set(
			id,
			setInterval(async () => {
				try {
					const response = await AdminService.getVMcpRepository(id);
					if (response && !response.isSyncing) {
						clearSyncInterval(id);
						vmcpRepositories = await AdminService.listVMcpRepositories();
						syncing.delete(id);
					}
				} catch (err) {
					errors.append(`Failed to sync vMCP repository: ${err}`);
					clearSyncInterval(id);
					syncing.delete(id);
				}
			}, 5000)
		);
	}

	async function sync(id: string) {
		syncing.add(id);
		try {
			await AdminService.refreshVMcpRepository(id);
			pollTillSyncComplete(id);
		} catch (err) {
			errors.append(`Failed to refresh vMCP repository sync status: ${err}`);
			syncing.delete(id);
		}
	}

	function closeSourceDialog() {
		editingSource = undefined;
		sourceError = undefined;
		saving = false;
		sourceDialog?.close();
	}

	function openAddSource() {
		editingSource = {
			index: -1,
			value: '',
			name: '',
			ref: 'main',
			token: '',
			gitCredentialID: '',
			credentialType: 'none'
		};
		sourceDialog?.showModal();
	}

	function openEditSource(repository: VMcpRepository) {
		editingSource = {
			index: vmcpRepositories.findIndex((candidate) => candidate.id === repository.id),
			value: repository.repoURL,
			name: repository.displayName,
			ref: repository.ref,
			token: '',
			gitCredentialID: repository.gitCredentialID ?? '',
			credentialType: repository.gitCredentialID
				? 'shared'
				: hasVMcpRepositoryToken(repository)
					? 'token'
					: 'none',
			repositoryID: repository.id
		};
		sourceDialog?.showModal();
	}

	function openVMcpsForRepository() {
		goto(`${page.url.pathname}?view=vmcps`);
	}

	function vmcpComponents(vmcp: MCPCatalogEntry) {
		const { entries, servers } = mcpServersAndEntries.current;
		return resolveVMcpComponents(vmcp, entries, servers);
	}

	function handleConnectVMcp(vmcp: MCPCatalogEntry) {
		connectToServerDialog?.open({ entry: vmcp });
	}

	function openConnectAllDialog(option: (typeof COMMON_AI_CLIENTS)[number]) {
		selectedClient = option;
		selectedConnectAllSnippetId = undefined;
		connectAllCopyField?.clear?.();
		connectAllVMcpsDialog?.open();
	}

	function handleConnectToServer({ instance }: { instance?: MCPServerInstance }) {
		if (instance) {
			mcpServersAndEntries.refreshUserInstances();
		} else {
			mcpServersAndEntries.refreshUserConfiguredServers();
		}
	}

	function openCreate() {
		goto(`${page.url.pathname}?new=true`);
	}

	function hideCreate() {
		const url = new URL(page.url);
		url.searchParams.delete('new');
		goto(url, { replaceState: true });
	}

	function openVMcp(vmcp: MCPCatalogEntry) {
		goto(`/vmcps/${vmcp.id}`);
	}

	onDestroy(() => {
		for (const interval of syncInterval.values()) {
			clearInterval(interval);
		}
	});
</script>

{#if creating}
	<VMcpDesigner onBack={hideCreate} />
{:else}
	<TabLayout
		title="vMCPs"
		defaultView="vmcps"
		rightNavActions={navActions}
		{views}
		classes={{
			container: 'min-h-0',
			childrenContainer: 'max-w-full'
		}}
	/>
{/if}

{#snippet navActions(view: string)}
	{#if view === 'sources'}
		{#if !isAdminReadonly}
			<a
				class="btn btn-secondary flex items-center gap-1 text-sm"
				href={resolve('/admin/platform?view=git-credentials')}
			>
				<Settings class="size-4" /> Manage Credentials
			</a>
			<button class="btn btn-primary flex items-center gap-1 text-sm" onclick={openAddSource}>
				<Plus class="size-4" /> Add Source URL
			</button>
		{/if}
	{:else}
		<div class="flex items-center gap-2 md:mr-4">
			<p class="text-xs font-light">Connect all vMCPs:</p>
			{#each options as option (option.id)}
				<IconButton
					class="btn-sm bg-base-200 hover:bg-base-400 dark:hover:bg-base-300"
					tooltip={{ text: option.alt, placement: 'bottom' }}
					onclick={() => openConnectAllDialog(option)}
				>
					<img src={option.icon} alt={option.alt} class="size-4 block dark:hidden" />
					<img
						src={option.iconDark ?? option.icon}
						alt={option.alt}
						class="size-4 hidden dark:block"
					/>
				</IconButton>
			{/each}
		</div>
		<button class="btn btn-primary" onclick={openCreate}>
			<Plus class="size-4" /> Create vMCP
		</button>
	{/if}
{/snippet}

{#snippet vmcpsView()}
	{#if isLoading}
		<Loading class="text-primary" />
	{:else}
		<VMcpListSettings
			bind:showAllConnectors
			bind:sortBy
			bind:ownerFilterBy
			bind:componentFilterBy
			{componentFilterOptions}
		/>
		<VMcpList
			items={composites}
			components={vmcpComponents}
			onSelect={openVMcp}
			onConnect={handleConnectVMcp}
			onDelete={(item) => createEditVMcp?.openDelete(item)}
		>
			{#snippet noDataContent()}
				<div class="my-12 flex w-md flex-col items-center gap-4 self-center text-center">
					<Layers class="text-muted-content size-24 opacity-25" />
					<div>
						<h4 class="text-muted-content text-lg font-semibold">
							{profile.current.hasAdminAccess?.() ? 'Create a vMCP!' : 'No vMCPs available'}
						</h4>
						<p class="text-muted-content text-sm font-light">
							{profile.current.hasAdminAccess?.()
								? 'Click below to get started.'
								: "Looks like there aren't any vMCPs available yet."}
						</p>
					</div>
					{#if profile.current.hasAdminAccess?.()}
						<button class="btn btn-primary" onclick={openCreate}>
							<Plus class="size-4" /> Create vMCP Now
						</button>
					{/if}
				</div>
			{/snippet}
		</VMcpList>
	{/if}
{/snippet}

{#snippet sourcesView()}
	{#if isSyncing}
		<div class="p-4" transition:slide={{ axis: 'y' }}>
			<div class="notification-info p-3 text-sm font-light">
				<div class="flex items-center gap-3">
					<Info class="size-6" />
					<div>The system is currently syncing with your configured Git repositories.</div>
				</div>
			</div>
		</div>
	{/if}
	<SourcesView
		{vmcpRepositories}
		syncingIds={syncing}
		{isAdminReadonly}
		onEdit={openEditSource}
		onDelete={(repositories) => (deletingSources = repositories)}
		onSync={sync}
		onOpenSyncError={(url, error) => {
			syncError = { url, error };
			syncErrorDialog?.open();
		}}
		onSelectRepository={openVMcpsForRepository}
	/>
{/snippet}

<ConnectToServer
	bind:this={connectToServerDialog}
	catalogID={DEFAULT_MCP_CATALOG_ID}
	onConnect={handleConnectToServer}
/>

<CreateEditVMcp bind:this={createEditVMcp} />

<ResponsiveDialog bind:this={connectAllVMcpsDialog} id="connect-all-vmcps-dialog">
	{#snippet titleContent()}
		{#if selectedClient}
			<img src={selectedClient.icon} alt="" class="mt-0.5 size-4 block dark:hidden" />
			<img
				src={selectedClient.iconDark ?? selectedClient.icon}
				alt=""
				class="mt-0.5 size-4 hidden dark:block"
			/>
			Connect All vMCPs
		{/if}
	{/snippet}
	<div class="flex flex-col gap-3 md:p-0 p-4">
		{#if connectAllVmcps.length === 0}
			<p class="text-sm text-muted-content font-light">
				No vMCPs currently have a connection URL to copy.
			</p>
		{:else if selectedConnectAllSnippet}
			{#if connectAllSnippets.length > 1}
				<div role="tablist" class="tabs tabs-box" aria-label="Configuration files">
					{#each connectAllSnippets as snippet (snippet.id)}
						<button
							type="button"
							role="tab"
							aria-selected={selectedConnectAllSnippet.id === snippet.id}
							aria-controls="connect-all-snippet-panel"
							class={twMerge('tab', selectedConnectAllSnippet.id === snippet.id && 'tab-active')}
							onclick={() => (selectedConnectAllSnippetId = snippet.id)}
						>
							{snippet.label}
						</button>
					{/each}
				</div>
			{/if}
			{#if selectedClient}
				<div class="flex items-start gap-2 text-sm">
					<div class="flex flex-col gap-2 text-muted-content font-light">
						{#if selectedClient.id === AiClient.Claude}
							{#if isAdmin && selectedConnectAllSnippet.id === 'claude-settings-json'}
								<p>
									Go to <code class="text-base-content"
										>Admin Settings > Claude Code > Managed settings</code
									> and add the following configuration JSON:
								</p>
							{:else}
								<p>
									Copy the configuration below into your project's <code class="text-base-content"
										>.mcp.json</code
									>
									or your user-level
									<code class="text-base-content">~/.claude.json</code>.
								</p>
							{/if}
						{:else if selectedClient.id === AiClient.Codex}
							<p>
								Copy these tables into
								<code class="text-base-content">~/.codex/config.toml</code>
								or a project-scoped
								<code class="text-base-content">.codex/config.toml</code>.
							</p>
						{:else if selectedClient.id === AiClient.Cursor}
							<p>
								Copy the configuration below into
								<code class="text-base-content">~/.cursor/mcp.json</code>
								or your project's
								<code class="text-base-content">.cursor/mcp.json</code>.
							</p>
						{:else if selectedClient.id === AiClient.VSCode}
							<p>
								Copy this configuration into your workspace
								<code class="text-base-content">.vscode/mcp.json</code>.
							</p>
						{/if}
					</div>
				</div>
			{/if}
			<div class="relative" id="connect-all-snippet-panel" role="tabpanel">
				<pre
					class="pl-4 pr-22 py-2 m-0 max-h-96 overflow-y-auto dark:bg-base-200"
					id={`connect-all-mcp-json-${selectedConnectAllSnippet.id}`}><code
						class="font-mono text-xs">{selectedConnectAllSnippet.value}</code
					></pre>
				<div class="absolute top-4 right-4">
					<CopyButton
						text={selectedConnectAllSnippet.value}
						id={`connect-all-mcp-json-copy-button-${selectedConnectAllSnippet.id}`}
						classes={{ button: 'flex shrink-0 gap-2 text-xs' }}
						showTextLeft
					/>
				</div>
			</div>
		{/if}
	</div>
</ResponsiveDialog>

<Confirm
	msg={deletingSources
		? deletingSources.length === 1
			? `Delete ${deletingSources[0].displayName}?`
			: `Delete the following Git Source URLs?`
		: 'Confirm Delete'}
	show={Boolean(deletingSources && deletingSources.length > 0)}
	onsuccess={async () => {
		if (!deletingSources) return;
		deleting = true;
		try {
			for (const source of deletingSources) {
				await AdminService.deleteVMcpRepository(source.id);
			}
			vmcpRepositories = await AdminService.listVMcpRepositories();
		} catch (error) {
			errors.append(`Failed to delete Git Source URLs: ${error}`);
		} finally {
			deletingSources = undefined;
			deleting = false;
		}
	}}
	oncancel={() => (deletingSources = undefined)}
	loading={deleting}
>
	{#snippet note()}
		{#if deletingSources && deletingSources.length > 1}
			<ul class="mb-3">
				{#each deletingSources as source (source.id)}
					<li>{source.displayName}</li>
				{/each}
			</ul>
		{/if}
		<p>
			Are you sure you want to delete {deletingSources && deletingSources.length > 1
				? 'these'
				: 'this'}? This will delete all related vMCPs and their information from the system.
		</p>
	{/snippet}
</Confirm>

<ResponsiveDialog title="Git Source URL Sync" bind:this={syncErrorDialog} class="md:w-2xl">
	<div class="mb-4 flex flex-col gap-4">
		<div class="notification-alert flex flex-col gap-2">
			<div class="flex items-center gap-2">
				<TriangleAlert class="size-6 shrink-0 self-start text-warning" />
				<p class="my-0.5 flex flex-col text-sm font-semibold">
					An issue occurred fetching this source URL:
				</p>
			</div>
			<span class="text-sm font-light break-all">{syncError?.error}</span>
		</div>
	</div>
</ResponsiveDialog>

<dialog bind:this={sourceDialog} class="dialog">
	<div class="dialog-container w-full max-w-md p-4 h-134.5 max-h-dvh flex flex-col">
		{#if editingSource}
			<h3 class="dialog-title">
				{editingSource.index === -1 ? 'Add Source URL' : 'Edit Source URL'}
				<IconButton onclick={() => closeSourceDialog()} class="btn-sm dialog-close-btn">
					<X class="size-5" />
				</IconButton>
			</h3>

			<div class="flex flex-col gap-4">
				<div class="flex flex-col gap-1">
					<label for="vmcp-source-name" class="flex-1 text-sm font-light capitalize">Name </label>
					<input id="vmcp-source-name" bind:value={editingSource.name} class="text-input-filled" />
				</div>
				<div class="flex flex-col gap-1">
					<label for="vmcp-source-url" class="flex-1 text-sm font-light capitalize"
						>Source URL
					</label>
					<input
						id="vmcp-source-url"
						bind:value={editingSource.value}
						oninput={handleVMcpSourceURLInput}
						class="text-input-filled"
					/>
				</div>
				<div class="flex flex-col gap-1">
					<label for="vmcp-source-ref" class="flex-1 text-sm font-light capitalize"
						>Reference
					</label>
					<input id="vmcp-source-ref" bind:value={editingSource.ref} class="text-input-filled" />
					<span class="text-muted-content text-xs"
						>The branch, commit SHA, or tag to index and pull vMCPs from.</span
					>
				</div>
				<div class="flex flex-col gap-2">
					<div class="flex flex-col gap-1">
						<div class="flex items-center justify-between gap-4">
							<span id="vmcp-source-credential-label" class="flex-1 text-sm font-light capitalize">
								Credential
							</span>
							{#if credentialLocked}
								<div class="flex justify-end">
									<button
										class="text-xs text-error hover:underline"
										onclick={() => {
											if (!editingSource) return;
											editingSource.credentialType = 'none';
											editingSource.gitCredentialID = '';
											editingSource.token = '';
											editingSource.clearToken = true;
										}}
									>
										Clear token
									</button>
								</div>
							{/if}
						</div>
						<Select
							id="vmcp-source-credential-type"
							class="bg-base-200"
							options={repositoryCredentialOptions}
							selected={editingSource.credentialType}
							ariaLabelledby="vmcp-source-credential-label"
							disabled={credentialLocked}
							onSelect={(option) => {
								if (!editingSource || credentialLocked) return;
								editingSource.credentialType = option.id as RepositoryCredentialType;
								if (option.id === 'shared') {
									editingSource.token = '';
								} else if (option.id === 'token') {
									editingSource.gitCredentialID = '';
								} else {
									editingSource.gitCredentialID = '';
									editingSource.token = '';
									if (hasVMcpRepositoryToken(editingVMcpRepository)) {
										editingSource.clearToken = true;
									}
								}
							}}
						/>
					</div>
					{#if editingSource.credentialType === 'shared'}
						<div class="flex flex-col gap-1">
							<Select
								id="vmcp-source-git-credential"
								class="bg-base-200"
								options={gitCredentialOptions}
								selected={editingSource.gitCredentialID}
								searchPlaceholder=""
								searchInDropdown
								disabled={credentialLocked}
								onSelect={(option) => {
									if (!editingSource || credentialLocked) return;
									editingSource.gitCredentialID = String(option.id);
									editingSource.token = '';
								}}
								onClear={!credentialLocked && editingSource.gitCredentialID
									? () => {
											if (editingSource) editingSource.gitCredentialID = '';
										}
									: undefined}
							/>
							<span class="text-muted-content text-xs">
								Only credentials matching the repository host can be selected.
							</span>
						</div>
					{/if}
					{#if editingSource.credentialType === 'token'}
						<div class="flex flex-col gap-1">
							<label for="vmcp-source-token" class="sr-only">Personal Access Token</label>
							{#if credentialLocked && existingVMcpRepositoryToken}
								<input
									id="vmcp-source-token"
									type="text"
									readonly
									aria-readonly="true"
									data-1p-ignore
									value={existingVMcpRepositoryToken}
									class="text-sm text-muted-content w-full border-none bg-transparent p-0 outline-none focus:ring-0 min-h-10"
								/>
							{:else}
								<SensitiveInput
									name="vmcp-source-token"
									placeholder="Personal Access Token"
									bind:value={editingSource.token}
								/>
							{/if}
						</div>
					{/if}
				</div>
			</div>

			{#if sourceError}
				<div class="mb-4 flex flex-col gap-2 text-error">
					<div class="flex items-center gap-2">
						<TriangleAlert class="size-6 shrink-0 self-start" />
						<p class="my-0.5 flex flex-col text-sm font-semibold">Error saving source URL:</p>
					</div>
					<span class="font-sm font-light break-all">{sourceError}</span>
				</div>
			{/if}

			<div class="flex grow mb-4"></div>

			<div class="flex w-full justify-end gap-2">
				<button class="btn btn-secondary" disabled={saving} onclick={() => closeSourceDialog()}
					>Cancel</button
				>
				<button
					class="btn btn-primary"
					disabled={saving || credentialSelectionIncomplete}
					onclick={async () => {
						if (!editingSource) {
							return;
						}

						saving = true;
						sourceError = undefined;

						try {
							const repoURL = editingSource.value.trim();
							const token = editingSource.token.trim();
							const manifest: Parameters<typeof AdminService.createVMcpRepository>[0] = {
								displayName: editingSource.name,
								repoURL,
								ref: editingSource.ref
							};
							if (editingSource.gitCredentialID) {
								manifest.gitCredentialID = editingSource.gitCredentialID;
							} else if (editingSource.credentialType === 'token' && token) {
								manifest.sourceURLCredentials = { [repoURL]: token };
							} else if (
								!token &&
								(editingSource.clearToken ||
									(editingSource.credentialType !== 'token' &&
										hasVMcpRepositoryToken(editingVMcpRepository)))
							) {
								manifest.sourceURLCredentials = { [repoURL]: '' };
							}
							const response = editingSource.repositoryID
								? await AdminService.updateVMcpRepository(editingSource.repositoryID, manifest)
								: await AdminService.createVMcpRepository(manifest);
							vmcpRepositories = editingSource.repositoryID
								? vmcpRepositories.map((repository) =>
										repository.id === response.id ? response : repository
									)
								: [...vmcpRepositories, response];
							sync(response.id);
							closeSourceDialog();
						} catch (error) {
							sourceError = parseErrorContent(error).message;
						} finally {
							saving = false;
						}
					}}
				>
					{editingSource.repositoryID ? 'Save' : 'Add'}
				</button>
			</div>
		{/if}
	</div>
	<form class="dialog-backdrop">
		<button type="button" onclick={() => closeSourceDialog()}>close</button>
	</form>
</dialog>

<svelte:head>
	<title>Obot | {creating ? 'Create vMCP' : 'vMCPs'}</title>
</svelte:head>
