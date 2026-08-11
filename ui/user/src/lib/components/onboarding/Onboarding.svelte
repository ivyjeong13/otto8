<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import Logo from '$lib/components/Logo.svelte';
	import { DEFAULT_MCP_CATALOG_ID } from '$lib/constants';
	import Loading from '$lib/icons/Loading.svelte';
	import { AdminService, UserService } from '$lib/services';
	import { darkMode, mcpServersAndEntries, profile } from '$lib/stores';
	import { adminConfigStore } from '$lib/stores/adminConfig.svelte';
	import Confirm from '../Confirm.svelte';
	import BetaLogo from '../navbar/BetaLogo.svelte';
	import Profile from '../navbar/Profile.svelte';
	import ConnectBasicMcps from './ConnectBasicMcps.svelte';
	import CurateMcps from './CurateMcps.svelte';
	import InstallObotSentry from './InstallObotSentry.svelte';
	import OnboardingChecklist from './OnboardingChecklist.svelte';
	import RadioOption from './RadioOption.svelte';
	import { EXAMPLE_MCPS, flyIn, flyOut, type OnboardingView } from './constants';
	import { Bot, ChevronRight, ExternalLink, Laptop, ScanEye, Server } from '@lucide/svelte';
	import { type Component } from 'svelte';
	import { fly } from 'svelte/transition';
	import { twMerge } from 'tailwind-merge';

	let currentView = $state<OnboardingView>('welcome');
	let selectedUsageOption = $state<string | undefined>(undefined);
	let confirmSkip = $state(false);
	let hasMinimalEntries = // requires obot-google-calendar, obot-gmail, obot-outlook
		$derived(
			['obot-google-calendar', 'obot-gmail', 'obot-outlook'].every((entry) =>
				mcpServersAndEntries.current.entries.some((e) => e.manifest.entryKey === entry)
			)
		);
	const storeData = $derived($adminConfigStore);

	let catalogStatus = $state<'saving' | 'syncing' | undefined>(undefined);
	let syncInterval = $state<ReturnType<typeof setInterval>>();
	let step = $state(0);

	let adminUsageOptions = [
		{
			id: 'curate',
			label: "See what Obot can do to help me curate my org's MCPs & agents",
			description: 'Begin set up of MCP access policies and agents through Obot.'
		},
		{
			id: 'monitor',
			label: 'See how Obot can help me secure & protect AI activity in my org',
			description: 'Walk through Obot Sentry installation and auditing.'
		}
	];

	let userUsageOptions = [
		{
			id: 'organize-day-gmail',
			label: 'Organize my day with Gmail & Google Calendar',
			description:
				'Walk through connecting to Gmail & Google Calender to my AI Client and start using it to organize my day.'
		},
		{
			id: 'organize-day-outlook',
			label: 'Organize my day with Outlook',
			description:
				'Walk through connecting to Outlook to my AI Client and start using it to organize my day.'
		}
	];

	async function handleAcceptEula() {
		if (storeData.eulaAccepted) return;
		const response = await AdminService.acceptEula();
		adminConfigStore.updateEula(response.accepted);
	}

	function handleUsageOptionChange(id: string) {
		selectedUsageOption = id;
	}

	async function handleSkipOnboarding() {
		await UserService.markProfileOnboarded();
		goto(resolve('/admin/dashboard'));
	}

	function pollTillSyncComplete() {
		if (syncInterval) {
			clearInterval(syncInterval);
		}

		syncInterval = setInterval(async () => {
			const response = await AdminService.getMCPCatalog(DEFAULT_MCP_CATALOG_ID);
			if (response && !response.isSyncing) {
				if (syncInterval) {
					clearInterval(syncInterval);
				}
				mcpServersAndEntries.refreshAll();
				catalogStatus = undefined;
				currentView = 'selected-usage';
			}
		}, 2500);
	}

	async function handleAddCatalogSource() {
		catalogStatus = 'saving';

		const response = await AdminService.getMCPCatalog(DEFAULT_MCP_CATALOG_ID);
		await AdminService.updateMCPCatalog(
			response.id,
			{
				...response,
				sourceURLs: [...(response.sourceURLs ?? []), 'https://github.com/obot-platform/mcp-catalog']
			},
			{
				dontLogErrors: true
			}
		);
		await AdminService.refreshMCPCatalog(DEFAULT_MCP_CATALOG_ID);

		catalogStatus = 'syncing';
		pollTillSyncComplete();
	}

	const boxClasses =
		'shrink-0 dark:border-base-400 dark:bg-base-300 bg-base-100 flex h-fit flex-col gap-4 rounded-xl border border-transparent p-6 shadow-sm max-w-[calc(100vw-2rem)]';
</script>

<div class="fixed top-0 left-0 w-full">
	<div class="flex items-center justify-between p-2 pl-4">
		<BetaLogo />
		<div class="flex items-center gap-2">
			<button
				class="btn btn-ghost text-muted-content hover:text-base-content"
				onclick={() => (confirmSkip = true)}
			>
				Skip Onboarding <ChevronRight class="size-4" />
			</button>
			<Profile />
		</div>
	</div>
</div>
<div class="fixed top-16 left-0 w-full justify-items-center">
	<OnboardingChecklist
		{step}
		{selectedUsageOption}
		show={currentView === 'selected-usage' || currentView === 'load-catalog-source'}
	/>
</div>

<div
	class="text-base-content dark:from-base-300 to-base-200 flex h-dvh w-full flex-col items-center justify-center bg-radial-[at_50%_50%] from-gray-50 dark:to-black overflow-x-hidden"
>
	<div class="flex items-center justify-center">
		{#if currentView === 'welcome'}
			{@render welcome()}
		{:else if currentView === 'interests'}
			{@render interests()}
		{:else if currentView === 'done'}
			{@render done()}
		{:else if currentView === 'load-catalog-source'}
			{@render loadCatalogSource()}
		{:else}
			<div class="flex items-center justify-center" in:fly={flyIn} out:fly={flyOut}>
				{#if selectedUsageOption === 'curate'}
					<CurateMcps
						{step}
						onBack={() => {
							selectedUsageOption = undefined;
							currentView = 'interests';
						}}
						onDone={() => {
							currentView = 'done';
						}}
						{boxClasses}
					/>
				{:else if selectedUsageOption === 'monitor'}
					<InstallObotSentry
						{step}
						{boxClasses}
						onDone={() => {
							currentView = 'done';
						}}
						onBack={() => {
							selectedUsageOption = undefined;
							currentView = 'interests';
						}}
					/>
				{:else if selectedUsageOption === 'organize-day-gmail' || selectedUsageOption === 'organize-day-outlook'}
					<ConnectBasicMcps
						{step}
						{boxClasses}
						onBack={() => {
							selectedUsageOption = undefined;
							currentView = 'interests';
						}}
						onDone={() => {
							currentView = 'done';
						}}
						variant={selectedUsageOption === 'organize-day-gmail' ? 'gmail' : 'outlook'}
					/>
				{/if}
			</div>
		{/if}
	</div>
</div>

{#snippet welcome()}
	<div class={twMerge(boxClasses, 'w-sm')} out:fly={flyOut}>
		<div class="flex w-full items-center justify-center">
			<Logo class="size-18" />
		</div>
		<h2 class="text-center text-2xl font-semibold">Welcome to Obot!</h2>

		<div class="w-fit self-center">
			<p class="text-center">Let us walk through an initial experience to help you get started!</p>

			{#if !storeData.eulaAccepted}
				<p class="pt-4 text-center">
					By continuing, you agree to Obot's <a
						href="https://obot.ai/eul"
						rel="external"
						target="_blank"
						class="text-link">EULA</a
					>.
				</p>
			{/if}
		</div>
		<button
			class="btn btn-primary mt-4 flex justify-center text-center"
			onclick={() => {
				handleAcceptEula();
				currentView = 'interests';
			}}
		>
			Next
		</button>
	</div>
{/snippet}

{#snippet interests()}
	<div class={twMerge(boxClasses, 'w-2xl')} in:fly={flyIn} out:fly={flyOut}>
		<h2 id="usage-options-heading" class="text-center text-2xl font-semibold">
			What brings you to Obot?
		</h2>
		<p class="mb-2 text-center">We'll walk you through to accomplish your goals.</p>

		{#if profile?.current.isAdmin?.()}
			<div class="flex flex-col gap-1">
				<h3 class="text-lg font-semibold">As an Admin...</h3>
				<div
					class="grid grid-cols-12 gap-2 @container"
					role="radiogroup"
					aria-labelledby="usage-options-heading"
				>
					{#each adminUsageOptions as option (option.id)}
						<RadioOption
							label={option.label}
							id={option.id}
							description={option.description}
							checked={selectedUsageOption === option.id}
							onChange={handleUsageOptionChange}
							includeObot
						/>
					{/each}
				</div>
			</div>
		{/if}
		<div class="flex flex-col gap-1">
			{#if profile?.current.isAdmin?.()}
				<h3 class="text-lg font-semibold">As a User...</h3>
			{/if}
			<div
				class="grid grid-cols-12 gap-2 @container"
				role="radiogroup"
				aria-labelledby="usage-options-heading"
			>
				{#each userUsageOptions as option (option.id)}
					<RadioOption
						label={option.label}
						id={option.id}
						description={option.description}
						checked={selectedUsageOption === option.id}
						onChange={handleUsageOptionChange}
						includeObot
					/>
				{/each}
			</div>
		</div>

		<div class="flex flex-col w-full gap-2 mt-4">
			<button
				type="button"
				class="btn btn-secondary w-full text-muted-content hover:text-base-content"
				onclick={() => (confirmSkip = true)}
			>
				Skip Onboarding
			</button>
			<button
				type="button"
				class="btn btn-primary w-full"
				disabled={!selectedUsageOption}
				onclick={() => {
					currentView =
						selectedUsageOption !== 'monitor' && !hasMinimalEntries
							? 'load-catalog-source'
							: 'selected-usage';
				}}
			>
				Next
			</button>
		</div>
	</div>
{/snippet}

{#snippet done()}
	<div class={twMerge(boxClasses, 'w-lg')} in:fly={flyIn} out:fly={flyOut}>
		<h2 class="text-center text-2xl font-semibold">Do More w/ Obot!</h2>
		{#if selectedUsageOption === 'organize-day-gmail' || selectedUsageOption === 'organize-day-outlook'}
			<p>You've completed your first interaction between the Obot Gateway and your AI client!</p>
		{/if}

		{#if selectedUsageOption === 'monitor'}
			<p>You've completed your first installation of Obot Sentry and your first device scan!</p>
		{/if}

		<p>
			<b class="font-semibold">Next Steps...</b> Dive into more of Obot's features to get the most out
			of your AI. Here are some suggestions:
		</p>

		<div class="flex flex-col gap-2">
			{@render completeOption(
				'Audit MCP & AI Activity',
				'Review audit logs to ensure your MCPs and AI activity are secure and compliant.',
				ScanEye,
				'/admin/audit-logs'
			)}
			{@render completeOption(
				'Expand MCP Catalog',
				'Browse existing catalog to expand what users can use or begin adding your own custom entries.',
				Logo,
				'/admin/mcp-catalog'
			)}
			{#if selectedUsageOption === 'monitor'}
				{@render completeOption(
					'Visit Device Dashboard',
					'See device scan results or enforcement decisions to resolve from installing Obot Sentry.',
					Laptop,
					'/admin/devices'
				)}
			{/if}
			{@render completeOption(
				'Connect MCP Servers',
				'Expand your workflow and connect additional MCP servers to your AI client(s).',
				Server,
				'/mcp-servers'
			)}
			{@render completeOption(
				'Chat w/ Hosted Agents',
				'Begin collaborating with hosted agents created by your organization.',
				Bot,
				'/hosted-agents'
			)}
		</div>

		<a class="btn btn-primary mt-4 flex justify-center text-center" href={resolve('/dashboard')}>
			Go to Dashboard
		</a>
	</div>
{/snippet}

{#snippet completeOption(label: string, description: string, icon: Component, href: string)}
	{@const Icon = icon}
	<button
		class="bg-base-200 hover:bg-base-200/50 items-center flex cursor-pointer gap-3 rounded-lg border border-transparent p-3 has-checked:border-primary has-checked:bg-primary/10"
		onclick={async () => {
			await UserService.markProfileOnboarded();
			goto(resolve(href as `/${string}`));
		}}
	>
		<Icon class="size-6 shrink-0" />
		<div class="flex flex-col gap-1 text-left">
			<span>{label}</span>
			<span class="text-xs text-muted-content">
				{description}
			</span>
		</div>
	</button>
{/snippet}

{#snippet loadCatalogSource()}
	<div class={twMerge(boxClasses, 'w-md @container')} in:fly={flyIn} out:fly={flyOut}>
		<h2 class="text-center text-2xl font-semibold">Add Obot MCP Catalog</h2>
		<p>
			Obot has a default catalog of MCPs available for use. This includes, and is not limited to,
			the following MCPs:
		</p>

		{@render exampleMcps()}

		<a
			class="btn"
			href="https://github.com/obot-platform/mcp-catalog"
			target="_blank"
			rel="external"
		>
			View Catalog on GitHub <ExternalLink class="size-4" />
		</a>

		<p>Clicking continue will add this catalog to your MCP Catalog.</p>

		<div class="flex w-full gap-2 mt-0 flex-col @lg:flex-row">
			<button
				class="btn btn-secondary @lg:flex-1"
				onclick={() => {
					currentView = 'interests';
				}}
			>
				Back
			</button>
			<button
				type="button"
				class="btn btn-primary @lg:flex-1"
				disabled={!selectedUsageOption}
				onclick={handleAddCatalogSource}
			>
				{#if catalogStatus}
					<Loading class="text-primary-content" />
					{catalogStatus === 'saving' ? 'Saving...' : 'Syncing...'}
				{:else}
					Continue
				{/if}
			</button>
		</div>
	</div>
{/snippet}

{#snippet exampleMcps()}
	<ul class="flex flex-wrap gap-2 items-center justify-center">
		{#each EXAMPLE_MCPS as mcp (mcp.label)}
			<li class="tooltip bg-white dark:bg-base-200 p-1" data-tip={mcp.label}>
				<img src={mcp.icon} alt={mcp.label} class="size-6 icon" />
			</li>
		{/each}
		<li class="text-muted-content text-xs">and many more!</li>
	</ul>
{/snippet}

<Confirm
	show={confirmSkip}
	title="Skip Onboarding?"
	onsuccess={handleSkipOnboarding}
	oncancel={() => {
		confirmSkip = false;
	}}
>
	{#snippet note()}
		Are you sure you want to skip the onboarding experience? We'll take you directly to the
		dashboard.
	{/snippet}
</Confirm>
