<script lang="ts">
	import Select from '$lib/components/Select.svelte';
	import { generateIdFromName } from '$lib/format';
	import Loading from '$lib/icons/Loading.svelte';
	import {
		AdminService,
		UserService,
		type MCPCatalogEntry,
		type MCPCatalogServer,
		type MCPServerTool
	} from '$lib/services';
	import { getMCPDisplayName, parseCategories } from '$lib/services/user/mcp';
	import { ENTERPRISE_PREFERENCE_ENTRY_KEYS } from '$lib/services/user/mcpSort';
	import { mcpServersAndEntries } from '$lib/stores';
	import CopyButton from '../CopyButton.svelte';
	import HowToConnect from '../mcp/HowToConnect.svelte';
	import CheckboxOption from './CheckboxOption.svelte';
	import SelectCategories from './SelectCategories.svelte';
	import { ENTERPRISE_CATEGORY_ALIASES, flyIn, flyOut } from './constants';
	import { Server } from '@lucide/svelte';
	import { untrack } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import { fly } from 'svelte/transition';
	import { twMerge } from 'tailwind-merge';

	interface Props {
		boxClasses: string;
		onBack: () => void;
		onDone: () => void;
		step: number;
	}

	// 0 = curate, 1 = accesspolicy, 2 = connect, 3 = interact
	let { boxClasses, onBack, onDone, step = $bindable() }: Props = $props();
	let selectedMCPs = $state<Record<string, boolean>>({});
	let extraMcpIds = $state<string[]>([]);
	let extraMcpQuery = $state('');
	let selectAllMcps = $state(false);
	let mcpSelectionCleared = $state(false);
	let savingAccessPolicy = $state(false);
	let selectedCategories = $state<Record<string, boolean>>({});
	let configured = new SvelteSet<string>();

	const dataset = $derived.by(() => {
		// eslint-disable-next-line svelte/prefer-svelte-reactivity
		const canonicalByLower = new Map<string, string>();
		return [
			...mcpServersAndEntries.current.servers,
			...mcpServersAndEntries.current.entries
		].reduce<Record<string, (MCPCatalogServer | MCPCatalogEntry)[]>>((acc, curr) => {
			// eslint-disable-next-line svelte/prefer-svelte-reactivity
			const seenOnItem = new Set<string>();
			for (const raw of parseCategories(curr)) {
				const category = raw.replace(/\s+/g, ' ');
				const lower = category.toLowerCase();
				if (!category || seenOnItem.has(lower)) continue;
				seenOnItem.add(lower);

				const key = canonicalByLower.get(lower) ?? category;
				if (!canonicalByLower.has(lower)) {
					canonicalByLower.set(lower, key);
				}
				if (!acc[key]) {
					acc[key] = [];
				}
				acc[key].push(curr);
			}
			return acc;
		}, {});
	});

	const ALL_MCP_SERVERS_ID = '*';
	const ALL_MCP_SERVERS_OPTION = {
		id: ALL_MCP_SERVERS_ID,
		label: 'All MCP Servers'
	};

	const allMcps = $derived.by(() => {
		// eslint-disable-next-line svelte/prefer-svelte-reactivity
		const seen = new Set<string>();
		const items: (MCPCatalogServer | MCPCatalogEntry)[] = [];
		for (const mcp of [
			...mcpServersAndEntries.current.servers,
			...mcpServersAndEntries.current.entries
		]) {
			if (seen.has(mcp.id)) continue;
			seen.add(mcp.id);
			items.push(mcp);
		}
		return items;
	});

	const mapMcpById = new Map<string, MCPCatalogServer | MCPCatalogEntry>(
		[...mcpServersAndEntries.current.servers, ...mcpServersAndEntries.current.entries].map(
			(mcp) => [mcp.id, mcp]
		)
	);

	const recommendedMcpList = $derived.by(() => {
		// eslint-disable-next-line svelte/prefer-svelte-reactivity
		const seen = new Set<string>();
		const items: (MCPCatalogServer | MCPCatalogEntry)[] = [];
		const addMcp = (mcp: MCPCatalogServer | MCPCatalogEntry) => {
			if (seen.has(mcp.id)) return;
			seen.add(mcp.id);
			items.push(mcp);
		};
		for (const category of Object.keys(selectedCategories)) {
			if (!selectedCategories[category]) continue;
			const aliases = ENTERPRISE_CATEGORY_ALIASES[category];
			if (aliases) {
				for (const [name, mcps] of Object.entries(dataset)) {
					if (aliases.includes(name.toLowerCase())) {
						mcps.forEach(addMcp);
					}
				}
				const entryKeys = ENTERPRISE_PREFERENCE_ENTRY_KEYS[category];
				if (entryKeys) {
					for (const mcp of allMcps) {
						if (
							'isCatalogEntry' in mcp &&
							mcp.manifest.entryKey &&
							entryKeys.includes(mcp.manifest.entryKey)
						) {
							addMcp(mcp);
						}
					}
				}
				continue;
			}
			for (const mcp of dataset[category] ?? []) {
				addMcp(mcp);
			}
		}
		return items;
	});
	const recommendedMcpIds = $derived(new Set(recommendedMcpList.map((mcp) => mcp.id)));
	const extraMcpIdSet = $derived(new Set(extraMcpIds));
	const extraMcpList = $derived(
		extraMcpIds
			.map((id) => allMcps.find((mcp) => mcp.id === id))
			.filter(
				(mcp): mcp is MCPCatalogServer | MCPCatalogEntry =>
					mcp != null && !recommendedMcpIds.has(mcp.id)
			)
	);
	const visibleMcps = $derived([...recommendedMcpList, ...extraMcpList]);
	const connectableMcps = $derived.by(() => {
		if (selectAllMcps) return allMcps;
		return allMcps.filter((mcp) => selectedMCPs[mcp.id]);
	});
	const connectMcpOptions = $derived(
		connectableMcps
			.map((mcp) => ({
				id: mcp.id,
				label: getMCPDisplayName(mcp) || mcp.id
			}))
			.sort((a, b) => a.label.localeCompare(b.label))
	);
	const addableMcpOptions = $derived.by(() => {
		const mcpOptions = allMcps
			.filter((mcp) => !recommendedMcpIds.has(mcp.id) && !extraMcpIdSet.has(mcp.id))
			.map((mcp) => ({
				id: mcp.id,
				label: getMCPDisplayName(mcp) || mcp.id
			}))
			.sort((a, b) => a.label.localeCompare(b.label));
		if (selectAllMcps) {
			return mcpOptions;
		}
		return [ALL_MCP_SERVERS_OPTION, ...mcpOptions];
	});

	$effect(() => {
		if (selectAllMcps) {
			selectedMCPs = {};
			return;
		}
		if (untrack(() => mcpSelectionCleared)) {
			return;
		}
		const next: Record<string, boolean> = {};
		for (const mcp of recommendedMcpList) {
			next[mcp.id] = true;
		}
		for (const id of extraMcpIds) {
			if (next[id]) continue;
			next[id] = untrack(() => selectedMCPs[id]) ?? true;
		}
		selectedMCPs = next;
	});

	let selectedConnectMcpId = $state('');
	let connectMcpQuery = $state('');
	const selectedConnectMcp = $derived(
		connectableMcps.find((mcp) => mcp.id === selectedConnectMcpId)
	);
	const selectedConnectUrl = $derived(
		selectedConnectMcp ? getConnectUrl(selectedConnectMcp) : undefined
	);
	const configuredMcpServer = $derived(
		mcpServersAndEntries.current.userConfiguredServers.find(
			(server) =>
				server.catalogEntryID === selectedConnectMcpId || server.id === selectedConnectMcpId
		)
	);
	let configuredMcpServerTools = $state<MCPServerTool[]>([]);

	$effect(() => {
		if (configuredMcpServer) {
			UserService.listMcpCatalogServerTools(configuredMcpServer.id).then((tools) => {
				configuredMcpServerTools = tools;
			});
		}
	});

	function getConnectUrl(mcp: MCPCatalogServer | MCPCatalogEntry): string | undefined {
		if (mcp.connectURL) return mcp.connectURL;
		const match = [
			...mcpServersAndEntries.current.userConfiguredServers,
			...mcpServersAndEntries.current.servers
		].find((server) => server.id === mcp.id || server.catalogEntryID === mcp.id);
		return match?.connectURL || undefined;
	}

	let unsubscribeFromUserReturn = () => {};
	function subscribeToUserReturn(handler: () => void) {
		document.addEventListener('visibilitychange', handler);
		window.addEventListener('focus', handler);
		return () => {
			document.removeEventListener('visibilitychange', handler);
			window.removeEventListener('focus', handler);
		};
	}

	const INTERACTION_LOOKBACK_MS = 10 * 60 * 1000;
	let completingOnboarding = false;
	let interactionCheckInFlight = false;

	async function handleUserInteractionOccurred() {
		if (
			document.visibilityState !== 'visible' ||
			completingOnboarding ||
			interactionCheckInFlight ||
			!configuredMcpServer?.id
		) {
			return;
		}

		interactionCheckInFlight = true;
		const endTime = new Date();
		const startTime = new Date(endTime.getTime() - INTERACTION_LOOKBACK_MS);

		try {
			const { items } = await UserService.listAuditLogs({
				start_time: startTime.toISOString(),
				end_time: endTime.toISOString(),
				limit: 1,
				mcp_server: configuredMcpServer.id
			});

			if (!items?.length) return;

			completingOnboarding = true;
			unsubscribeFromUserReturn();
			onDone();
		} catch {
			// Stay on this step; the user can return to the window to retry.
		} finally {
			interactionCheckInFlight = false;
		}
	}

	const handleRefreshUserConfiguredServers = () => {
		if (document.visibilityState === 'visible') {
			mcpServersAndEntries.refreshUserConfiguredServers();
		}
	};

	$effect(() => {
		if (step !== 3) return;

		unsubscribeFromUserReturn = subscribeToUserReturn(handleUserInteractionOccurred);
		return () => {
			unsubscribeFromUserReturn();
		};
	});

	$effect(() => {
		if (step !== 2) return;

		return subscribeToUserReturn(handleRefreshUserConfiguredServers);
	});

	$effect(() => {
		if (step !== 2) return;
		if (connectMcpOptions.some((option) => option.id === selectedConnectMcpId)) return;
		selectedConnectMcpId = String(connectMcpOptions[0]?.id ?? '');
	});

	$effect(() => {
		if (step !== 2 || !selectedConnectMcp) return;

		for (const server of mcpServersAndEntries.current.userConfiguredServers) {
			configured.add(server.id);
			if (server.catalogEntryID) configured.add(server.catalogEntryID);
		}

		if (configured.has(selectedConnectMcp.id)) {
			step = 3;
		}
	});

	function handleSelectedMCPChange(id: string, checked: boolean) {
		selectedMCPs[id] = checked;
	}

	function handleAddExtraMcp(id: string) {
		if (id === ALL_MCP_SERVERS_ID) {
			selectAllMcps = true;
			extraMcpIds = [];
			mcpSelectionCleared = false;
			selectedMCPs = {};
			extraMcpQuery = '';
			return;
		}
		if (!id || recommendedMcpIds.has(id) || extraMcpIds.includes(id)) {
			return;
		}
		if (selectAllMcps) {
			selectAllMcps = false;
			mcpSelectionCleared = false;
			extraMcpIds = [id];
			selectedMCPs[id] = true;
			extraMcpQuery = '';
			return;
		}
		extraMcpIds = [...extraMcpIds, id];
		selectedMCPs[id] = true;
		extraMcpQuery = '';
	}

	function handleRemoveExtraMcp(id: string) {
		extraMcpIds = extraMcpIds.filter((current) => current !== id);
		selectedMCPs[id] = false;
	}

	function handleRemoveAllMcps() {
		selectAllMcps = false;
		extraMcpIds = [];
		mcpSelectionCleared = true;
		selectedMCPs = {};
	}

	async function handleUpdateAccessPolicy() {
		savingAccessPolicy = true;
		const mcps = Object.keys(selectedMCPs)
			.filter((mcp) => selectedMCPs[mcp])
			.map((mcp) => mapMcpById.get(mcp))
			.filter((mcp) => mcp !== undefined) as (MCPCatalogServer | MCPCatalogEntry)[];
		try {
			await AdminService.deleteAccessControlRule('acr1-everything', { dontLogErrors: true });
		} catch (err) {
			console.error(err);
		}

		const requiredResourcesEntrieKeys = ['obot-google-calendar', 'obot-gmail', 'obot-outlook'];
		const matches = mcpServersAndEntries.current.entries.filter(
			(entry) =>
				entry?.manifest.entryKey && requiredResourcesEntrieKeys.includes(entry.manifest.entryKey)
		);
		await AdminService.createAccessControlRule({
			displayName: 'Default',
			subjects: [
				{
					type: 'selector',
					id: '*'
				}
			],
			resources: selectAllMcps
				? [{ type: 'selector', id: ALL_MCP_SERVERS_ID }]
				: mcps.map((mcp) => ({
						type: 'isCatalogEntry' in mcp ? 'mcpServerCatalogEntry' : 'mcpServer',
						id: mcp.id
					}))
		});
		await AdminService.createAccessControlRule({
			displayName: 'Default Onboarding',
			subjects: [
				{
					type: 'selector',
					id: '*'
				}
			],
			resources: matches.map((entry) => ({
				type: 'mcpServerCatalogEntry',
				id: entry.id
			}))
		});
		savingAccessPolicy = false;
	}
</script>

{#if step === 0}
	<SelectCategories
		{selectedCategories}
		onContinue={() => {
			mcpSelectionCleared = false;
			step = 1;
		}}
		{onBack}
		{dataset}
		{boxClasses}
	/>
{:else if step === 1}
	{@render accesspolicy()}
{:else if step === 2}
	{@render connect()}
{:else if step === 3}
	{@render interact()}
{/if}

{#snippet accesspolicy()}
	<div class={twMerge(boxClasses, 'w-2xl @container')} in:fly={flyIn} out:fly={flyOut}>
		<h2 class="text-center text-2xl font-semibold">Set Up Access Policies</h2>
		<div class="flex flex-col gap-4">
			<p>Here are some recommended MCP servers & skills to start off with!</p>

			<div class="flex flex-col gap-2">
				{#if addableMcpOptions.length > 0}
					{#key `${extraMcpIds.join(',')}:${selectAllMcps}`}
						<Select
							id="onboarding-add-mcp"
							classes={{ root: 'w-full' }}
							options={addableMcpOptions}
							placeholder="Add an MCP server..."
							searchPlaceholder="Search MCP servers..."
							searchInDropdown
							bind:query={extraMcpQuery}
							selected=""
							onSelect={(option) => {
								handleAddExtraMcp(String(option.id));
							}}
						/>
					{/key}
				{/if}
				<div
					class="flex flex-col gap-1 max-h-88 overflow-y-auto default-scrollbar-thin"
					role="group"
					aria-label="Recommended MCP servers"
				>
					{#if selectAllMcps}
						<CheckboxOption
							label={ALL_MCP_SERVERS_OPTION.label}
							id={ALL_MCP_SERVERS_ID}
							description="Grants access to all current and future MCP servers"
							icon={Server}
							checked={true}
							onChange={(_id, checked) => {
								if (!checked) {
									handleRemoveAllMcps();
								}
							}}
							onRemove={handleRemoveAllMcps}
						/>
					{:else}
						{#each visibleMcps as mcp (mcp.id)}
							<CheckboxOption
								label={getMCPDisplayName(mcp)}
								id={mcp.id}
								description={mcp.manifest.description ?? ''}
								icon={mcp.manifest.icon ?? Server}
								checked={selectedMCPs[mcp.id]}
								onChange={handleSelectedMCPChange}
								onRemove={extraMcpIdSet.has(mcp.id) && !recommendedMcpIds.has(mcp.id)
									? () => handleRemoveExtraMcp(mcp.id)
									: undefined}
							/>
						{/each}
					{/if}
				</div>
			</div>

			<p class="mb-2">
				Regular users will be able to go ahead and access the following MCP servers & skills.
			</p>
		</div>

		<div class="flex w-full gap-2 flex-col @lg:flex-row">
			<button
				type="button"
				class="btn btn-secondary @lg:flex-1"
				onclick={() => {
					step = 0;
				}}
			>
				Back
			</button>
			<button
				type="submit"
				class="btn btn-primary @lg:flex-1"
				disabled={savingAccessPolicy}
				onclick={async () => {
					await handleUpdateAccessPolicy();
					step = 2;
				}}
			>
				{#if savingAccessPolicy}
					<Loading />
				{:else}
					Continue
				{/if}
			</button>
		</div>
	</div>
{/snippet}

{#snippet connect()}
	<div class={twMerge(boxClasses, 'w-2xl')} in:fly={flyIn} out:fly={flyOut}>
		<h2 class="text-center text-2xl font-semibold">Connect Your AI Client</h2>
		<p>
			Let's verify your access to a Obot Gateway MCP server. Select or use the chosen MCP server
			below & connect your preferred AI client to it.
		</p>

		{#if connectMcpOptions.length > 0}
			<Select
				id="onboarding-connect-mcp"
				classes={{ root: 'w-full' }}
				options={connectMcpOptions}
				placeholder="Select an MCP server..."
				searchPlaceholder="Search MCP servers..."
				searchInDropdown
				bind:query={connectMcpQuery}
				bind:selected={selectedConnectMcpId}
			>
				{#snippet buttonStartContent()}
					{@const selectedMcp = mapMcpById.get(selectedConnectMcpId)}
					{#if selectedMcp}
						<img
							src={selectedMcp.manifest.icon}
							alt={getMCPDisplayName(selectedMcp)}
							class="w-4 h-4"
						/>
					{/if}
				{/snippet}
			</Select>
		{/if}

		{#if selectedConnectMcp && selectedConnectUrl}
			{#key selectedConnectMcp.id}
				<HowToConnect
					id={generateIdFromName(getMCPDisplayName(selectedConnectMcp))}
					displayName={getMCPDisplayName(selectedConnectMcp)}
					url={selectedConnectUrl}
					hideDocs
				/>
			{/key}
		{/if}

		<p class="text-muted-content text-xs italic text-center animate-pulse">
			Waiting for connection...
		</p>
	</div>
{/snippet}

{#snippet interact()}
	<div class={twMerge(boxClasses, 'w-2xl')} in:fly={flyIn} out:fly={flyOut}>
		<h2 class="text-center text-2xl font-semibold">Interact w/ Your MCP Server</h2>
		<p>
			You now have access to your MCP server, so you can use your AI client to begin interacting
			with it.
		</p>
		<p>Here are some tools you can use to interact with your MCP server:</p>
		<ul class="flex flex-col gap-2 max-h-88 overflow-y-auto default-scrollbar-thin">
			{#each configuredMcpServerTools as tool (tool.id)}
				<li class="bg-base-200 flex items-start gap-3 rounded-lg p-3">
					<div class="flex min-w-0 flex-1 flex-col gap-1">
						<span class="text-sm font-medium">{tool.name}</span>
						<p class="text-muted-content text-sm line-clamp-2">{tool.description}</p>
					</div>
					<CopyButton text={tool.name} tooltipText="Copy tool name" />
				</li>
			{/each}
		</ul>
		<p class="text-muted-content text-xs italic text-center animate-pulse">
			Waiting for MCP server interaction...
		</p>
	</div>
{/snippet}
