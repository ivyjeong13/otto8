<script lang="ts">
	import McpMagicLink from '$lib/components/mcp/McpMagicLink.svelte';
	import Bots from '$lib/icons/Bots.svelte';
	import { UserService, type MCPCatalogEntry } from '$lib/services';
	import { AiClient, COMMON_AI_CLIENTS_MAP } from '$lib/services/user/constants';
	import {
		getAiClientCommand,
		getAiClientMagicLink,
		getMCPDisplayName
	} from '$lib/services/user/mcp';
	import { mcpServersAndEntries } from '$lib/stores';
	import CopyButton from '../CopyButton.svelte';
	import CopyField from '../CopyField.svelte';
	import RadioOption from './RadioOption.svelte';
	import { flyIn, flyOut } from './constants';
	import { Check } from '@lucide/svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import { fade, fly } from 'svelte/transition';
	import { twMerge } from 'tailwind-merge';

	interface Props {
		boxClasses: string;
		onBack: () => void;
		onDone: () => void;
		variant: 'gmail' | 'outlook';
		step: number;
	}

	// 0 = aiclient, 1 = mcp, 2 = connected
	let { boxClasses, onBack, onDone, variant, step = $bindable() }: Props = $props();
	let selectedAiClient = $state<string | undefined>(undefined);
	let configured = new SvelteSet<string>();

	function handleAiClientChange(id: string) {
		selectedAiClient = id;
	}

	const handleRefreshUserConfiguredServers = () => {
		if (document.visibilityState === 'visible') {
			mcpServersAndEntries.refreshUserConfiguredServers();
		}
	};

	const INTERACTION_LOOKBACK_MS = 10 * 60 * 1000;
	let completingOnboarding = false;
	let interactionCheckInFlight = false;

	let unsubscribeFromUserReturn = () => {};
	function subscribeToUserReturn(handler: () => void) {
		document.addEventListener('visibilitychange', handler);
		window.addEventListener('focus', handler);
		return () => {
			document.removeEventListener('visibilitychange', handler);
			window.removeEventListener('focus', handler);
		};
	}

	const handleUserInteractionOccurred = async () => {
		if (
			document.visibilityState !== 'visible' ||
			completingOnboarding ||
			interactionCheckInFlight
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
				limit: 1
			});
			if (items?.length === 0) return;

			completingOnboarding = true;
			unsubscribeFromUserReturn();
			onDone();
		} catch {
			// Stay on this step; the user can return to the window to retry.
		} finally {
			interactionCheckInFlight = false;
		}
	};

	$effect(() => {
		if (step !== 1) return;

		unsubscribeFromUserReturn = subscribeToUserReturn(handleRefreshUserConfiguredServers);
		return () => {
			unsubscribeFromUserReturn();
		};
	});

	$effect(() => {
		if (step !== 2) return;

		unsubscribeFromUserReturn = subscribeToUserReturn(handleUserInteractionOccurred);
		return () => {
			unsubscribeFromUserReturn();
		};
	});

	$effect(() => {
		if (step === 1) {
			mcpServersAndEntries.current.userConfiguredServers.forEach((server) => {
				configured.add(server.catalogEntryID);
			});

			if (mcpCatalogEntries.every((entry) => configured.has(entry.id))) {
				step = 2;
				document.removeEventListener('visibilitychange', handleRefreshUserConfiguredServers);
			}
		}
	});

	const aiClientOptions = [
		{
			id: AiClient.Cursor,
			label: 'Cursor',
			iconURL: '/user/images/assistant/cursor-mark.svg',
			description: ''
		},
		{
			id: AiClient.Claude,
			label: 'Claude',
			iconURL: '/user/images/assistant/claude-mark.svg',
			description: ''
		},
		{
			id: AiClient.VSCode,
			label: 'VSCode',
			iconURL: '/user/images/assistant/vscode-mark.svg',
			description: ''
		},
		{
			id: 'other',
			label: 'Other',
			iconURL: Bots,
			description: ''
		}
	];

	let entryKeys = $derived(
		variant === 'gmail' ? ['obot-gmail', 'obot-google-calendar'] : ['obot-outlook']
	);

	let mcpCatalogEntries = $derived(
		mcpServersAndEntries.current.entries.filter(
			(entry) => entry?.manifest?.entryKey && entryKeys.includes(entry.manifest.entryKey)
		)
	);

	const examplePrompts = $derived(
		variant === 'gmail'
			? [
					{
						label: 'Plan your day',
						text: "Review my unread Gmail from this morning and today's Google Calendar. Summarize what needs my attention and propose a prioritized plan for the rest of the day."
					},
					{
						label: 'Clear your inbox',
						text: 'Find Gmail threads that need a reply today, draft responses I can send, and block 30 minutes on my Google Calendar this afternoon to work through them.'
					},
					{
						label: 'Prep for meetings',
						text: "Look at my Google Calendar for the rest of the week. For any meeting I'm unprepared for, pull related Gmail threads, draft a short brief, and add a 15-minute prep block before each one."
					}
				]
			: [
					{
						label: 'Plan your day',
						text: "Review my unread Outlook emails from this morning and today's Outlook calendar. Summarize what needs my attention and propose a prioritized plan for the rest of the day."
					},
					{
						label: 'Clear your inbox',
						text: 'Find Outlook emails that need a reply today, draft responses I can send, and block 30 minutes on my calendar this afternoon to work through them.'
					},
					{
						label: 'Prep for meetings',
						text: "Look at my Outlook calendar for the rest of the week. For any meeting I'm unprepared for, pull related emails, draft a short brief, and add a 15-minute prep block before each one."
					}
				]
	);
</script>

{#if step === 1}
	{@render setupMcp()}
{:else if step === 2}
	{@render connected()}
{:else}
	{@render aiclient()}
{/if}

{#snippet aiclient()}
	<div class={twMerge(boxClasses, 'w-2xl @container')} in:fly={flyIn} out:fly={flyOut}>
		<h2 class="text-center text-2xl font-semibold">What's Your Go-to AI Client?</h2>
		<p>Select your preferred AI client below to get started!</p>

		<div
			class="grid grid-cols-12 gap-2 @container"
			role="radiogroup"
			aria-labelledby="usage-options-heading"
		>
			{#each aiClientOptions as option (option.id)}
				<RadioOption
					label={option.label}
					id={option.id}
					checked={selectedAiClient === option.id}
					onChange={handleAiClientChange}
				/>
			{/each}
		</div>

		<div class="flex w-full gap-2 flex-col @lg:flex-row">
			<button type="button" class="btn btn-secondary @lg:flex-1" onclick={onBack}> Back </button>
			<button
				type="button"
				class="btn btn-primary @lg:flex-1"
				onclick={() => (step = 1)}
				disabled={!selectedAiClient}
			>
				Continue
			</button>
		</div>
	</div>
{/snippet}

{#snippet setupMcp()}
	<div class={twMerge(boxClasses, 'w-2xl')} in:fly={flyIn} out:fly={flyOut}>
		<h2 class="text-center text-2xl font-semibold">Setting Up Your MCPs</h2>
		<p>
			In order to organize your day, you'll need to connect to your {variant === 'gmail'
				? 'Gmail & Google Calendar'
				: 'Outlook'} MCP server{variant === 'gmail' ? 's' : ''} first!
		</p>

		{@render connect()}

		<p class="text-muted-content text-xs italic text-center animate-pulse">
			Waiting for connection{variant === 'gmail' ? 's' : ''}...
		</p>
	</div>
{/snippet}

{#snippet connect()}
	{@const client = COMMON_AI_CLIENTS_MAP.get(selectedAiClient as AiClient)}
	<div class="flex flex-col gap-1">
		{#if client && (selectedAiClient === AiClient.Cursor || selectedAiClient === AiClient.VSCode)}
			<div class="divider mt-0">Quick Install</div>
			{#each mcpCatalogEntries as entry (entry.id)}
				{#if entry.connectURL}
					<McpMagicLink
						class={configured.has(entry.id) ? 'outline outline-success/50' : ''}
						client={selectedAiClient}
						link={getAiClientMagicLink(
							selectedAiClient,
							getMCPDisplayName(entry),
							entry.connectURL
						)}
						alt={client.alt}
						icon={client.icon}
						iconDark={client.iconDark}
					>
						{#snippet label()}
							{@render entryDisplayLabel(entry)}
						{/snippet}
					</McpMagicLink>
				{/if}
			{/each}
		{:else if client && selectedAiClient === AiClient.Claude}
			<div class="divider mt-0">Install via CLI</div>
			{#each mcpCatalogEntries as entry (entry.id)}
				{#if entry.connectURL}
					{@render commandField(
						entry,
						client,
						getAiClientCommand(selectedAiClient, getMCPDisplayName(entry), entry.connectURL)
					)}
				{/if}
			{/each}
		{:else if selectedAiClient === 'other'}
			<div class="divider mt-0">Connect via URL</div>
			{#each mcpCatalogEntries as entry (entry.id)}
				{#if entry.connectURL}
					<div id={`connect-url-${entry.id}-container`}>
						<CopyField
							value={entry.connectURL}
							id={`connect-url-${entry.id}`}
							classes={{
								inputLabel: 'bg-base-100 dark:bg-base-300'
							}}
						>
							{#snippet preContent()}
								<span class="label shrink-0 w-38 mr-0 text-base-content">
									{@render entryDisplayLabel(entry)}
								</span>
							{/snippet}
						</CopyField>
					</div>
				{/if}
			{/each}
		{/if}
	</div>
{/snippet}

{#snippet entryDisplayLabel(entry: MCPCatalogEntry)}
	{@const displayName = getMCPDisplayName(entry)}
	<img src={entry.manifest.icon} alt={displayName} class="size-4" />
	{displayName}
	{#if configured.has(entry.id)}
		<span in:fade>
			<Check class="size-4 text-success" />
		</span>
	{/if}
{/snippet}

{#snippet commandField(
	entry: MCPCatalogEntry,
	client: ReturnType<typeof COMMON_AI_CLIENTS_MAP.get>,
	command: string
)}
	{#if client}
		<div id={`command-${client.id}-container`}>
			<CopyField
				value={command}
				id={`command-${client.id}`}
				classes={{
					inputLabel: 'bg-base-100 dark:bg-base-300',
					input: 'font-mono'
				}}
			>
				{#snippet preContent()}
					<span class="label shrink-0 w-38 mr-0 text-base-content">
						{@render entryDisplayLabel(entry)}
					</span>
				{/snippet}
			</CopyField>
		</div>
	{/if}
{/snippet}

{#snippet connected()}
	<div class={twMerge(boxClasses, 'w-2xl')} in:fly={flyIn} out:fly={flyOut}>
		<h2 class="text-center text-2xl font-semibold">Organize Your Day!</h2>
		<p>
			You now have access to {variant === 'gmail' ? 'Gmail & Google Calendar' : 'Outlook'}, so you
			can use your AI client to begin organizing your day.
		</p>
		<p>Here are some example prompts to get you started:</p>
		<ul class="flex flex-col gap-2">
			{#each examplePrompts as prompt (prompt.label)}
				<li class="bg-base-200 flex items-start gap-3 rounded-lg p-3">
					<div class="flex min-w-0 flex-1 flex-col gap-1">
						<span class="text-sm font-medium">{prompt.label}</span>
						<p class="text-muted-content text-sm">{prompt.text}</p>
					</div>
					<CopyButton text={prompt.text} tooltipText="Copy prompt" />
				</li>
			{/each}
		</ul>
		<p class="text-muted-content text-xs italic text-center animate-pulse">
			Waiting for MCP server interaction...
		</p>
	</div>
{/snippet}
