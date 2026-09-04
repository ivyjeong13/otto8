<script lang="ts">
	import { resolve } from '$app/paths';
	import ResponsiveDialog from '$lib/components/ResponsiveDialog.svelte';
	import Loading from '$lib/icons/Loading.svelte';
	import {
		ACCESS_MATCH_REASON_LABEL,
		hasAnyCurrentAccess,
		loadCurrentAccess,
		type CurrentAccessSections,
		type CurrentAccessTarget,
		type MatchedAccessPolicy
	} from './currentAccess';
	import { ChevronRight } from '@lucide/svelte';

	interface Props {
		target?: CurrentAccessTarget;
	}

	let { target }: Props = $props();

	let dialog = $state<ReturnType<typeof ResponsiveDialog>>();
	let viewing = $state<CurrentAccessTarget>();
	let loading = $state(false);
	let loadError = $state('');
	let sections = $state<CurrentAccessSections>({
		mcp: [],
		models: [],
		skills: [],
		hostedAgents: []
	});
	let loadGeneration = 0;
	let currentTab = $state<'mcp' | 'models' | 'skills' | 'hostedAgents'>('mcp');

	export function open(next?: CurrentAccessTarget) {
		viewing = next ?? target;
		dialog?.open();
	}

	async function onOpen() {
		const current = viewing ?? target;
		if (!current) {
			return;
		}

		const generation = ++loadGeneration;
		loading = true;
		loadError = '';
		sections = { mcp: [], models: [], skills: [], hostedAgents: [] };

		try {
			const next = await loadCurrentAccess(current);
			if (generation !== loadGeneration) {
				return;
			}
			sections = next;
		} catch (error) {
			if (generation !== loadGeneration) {
				return;
			}
			loadError = error instanceof Error ? error.message : 'Failed to load access policies.';
		} finally {
			if (generation === loadGeneration) {
				loading = false;
			}
		}
	}

	function onClose() {
		loadGeneration += 1;
		loading = false;
		loadError = '';
		viewing = undefined;
	}

	const titleName = $derived(viewing?.name ?? target?.name ?? '');
	const subjectLabel = $derived(viewing?.kind === 'group' ? 'group' : 'user');

	const tabs = [
		{ label: 'MCP Servers', value: 'mcp' },
		{ label: 'Models', value: 'models' },
		{ label: 'Skills', value: 'skills' },
		{ label: 'Hosted Agents', value: 'hostedAgents' }
	];
</script>

<ResponsiveDialog
	bind:this={dialog}
	{onOpen}
	{onClose}
	title={titleName ? `${titleName} | Current Access` : 'Current Access'}
	class="h-full w-full overflow-hidden md:h-150 md:max-w-xl"
	classes={{ header: 'p-4 md:pb-0', content: 'min-h-inherit p-0' }}
>
	<div class="default-scrollbar-thin flex grow flex-col gap-4 overflow-y-auto px-4 pt-0 pb-4">
		<p class="text-muted-content text-sm font-light">
			Assigned policies that grant this {subjectLabel} access, including those assigned to All Obot Users
			{#if viewing?.kind === 'user'}
				and any groups they belong to
			{/if}.
		</p>

		{#if loading}
			<div class="flex grow items-center justify-center py-12">
				<Loading class="size-6" />
			</div>
		{:else if loadError}
			<div class="notification-error p-3 text-sm font-light">{loadError}</div>
		{:else if !hasAnyCurrentAccess(sections)}
			<div
				class="text-muted-content flex grow items-center justify-center py-12 text-center text-sm"
			>
				No access policies currently apply to this {subjectLabel}.
			</div>
		{:else}
			<div class="flex flex-col">
				<div class="tabs tabs-box shadow-inner">
					{#each tabs as tab (tab.value)}
						<button
							class="tab {currentTab === tab.value ? 'tab-active dark:bg-base-300' : ''}"
							onclick={() => (currentTab = tab.value as typeof currentTab)}>{tab.label}</button
						>
					{/each}
				</div>
				{@render policySection(sections[currentTab])}
			</div>
		{/if}
	</div>
</ResponsiveDialog>

{#snippet policySection(policies: MatchedAccessPolicy[])}
	<section>
		{#if policies.length === 0}
			<p class="text-muted-content px-1 text-sm font-light">
				No policies currently apply to this {subjectLabel}.
			</p>
		{:else}
			<div class="mt-2">
				{#each policies as policy, index (policy.id)}
					<a
						href={resolve(policy.href)}
						class="w-full hover:bg-base-300 dark:hover:bg-base-200 items-center flex justify-between gap-4 rounded-md px-2 py-2"
					>
						<div class="flex flex-col">
							<span class="text-sm">{policy.displayName}</span>
							<span class="text-muted-content text-xs font-light">
								{policy.reasons.map((reason) => ACCESS_MATCH_REASON_LABEL[reason]).join(' · ')}
							</span>
						</div>
						<ChevronRight class="size-4" />
					</a>
					{#if index < policies.length - 1}
						<div class="divider my-0.5 after:h-px before:h-px h-2"></div>
					{/if}
				{/each}
			</div>
		{/if}
	</section>
{/snippet}
