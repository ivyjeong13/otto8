<script lang="ts">
	import { autoHeight } from '$lib/actions/textarea';
	import { closeSidebarConfig, getLayout, type Layout } from '$lib/context/layout.svelte';
	import type { Assistant, AssistantTool, Project } from '$lib/services';
	import { ChevronsLeft } from 'lucide-svelte';
	import { fade } from 'svelte/transition';
	import { twMerge } from 'tailwind-merge';
	import Slack from './slack/Slack.svelte';
	import ChatBot from './edit/ChatBot.svelte';
	import Introduction from './edit/Introduction.svelte';
	import Knowledge from './edit/Knowledge.svelte';
	import Members from './edit/Members.svelte';
	import CustomTool from './edit/CustomTool.svelte';
	import { getProjectTools } from '$lib/context/projectTools.svelte';

	interface Props {
		project: Project;
		currentThreadID?: string;
		assistant?: Assistant;
	}

	let { project = $bindable(), currentThreadID = $bindable(), assistant }: Props = $props();
	const layout = getLayout();

	const agentViews = ['introduction', 'template'];
	const interfaceViews = ['chatbot', 'slack', 'discord', 'sms', 'email', 'webhook', 'interfaces'];

	const isAgentConfigView = $derived(
		layout.sidebarConfig && agentViews.includes(layout.sidebarConfig)
	);
	const isInterfaceConfigView = $derived(
		layout.sidebarConfig && interfaceViews.includes(layout.sidebarConfig)
	);

	const projectTools = getProjectTools();
	let toEdit = $state<AssistantTool>();

	$effect(() => {
		if (layout.customToolId) {
			toEdit = projectTools.tools.find((t) => t.id === layout.customToolId);
		}
	});
</script>

<div
	class="default-scrollbar-thin border-surface1 dark:border-surface2 relative flex w-full overflow-y-auto border-t"
	in:fade
>
	{#if isAgentConfigView}
		{@const agentTabs = [
			{ label: 'Introduction & Starter Messages', value: 'introduction' },
			{ label: 'Create Agent Template', value: 'template' }
		]}
		{@render tabs(agentTabs)}
		{#if layout.sidebarConfig === 'introduction'}
			<Introduction {project} />
		{:else}
			<div class="w-full p-8">
				{@render underConstruction()}
			</div>
		{/if}
	{:else if isInterfaceConfigView}
		{@const interfacesTabs = [
			{ label: 'Chatbot', value: 'chatbot' },
			{ label: 'Slack', value: 'slack' },
			{ label: 'Discord', value: 'discord' },
			{ label: 'SMS', value: 'sms' },
			{ label: 'Email', value: 'email' },
			{ label: 'Webhook', value: 'webhook' }
		]}
		{@render tabs(interfacesTabs)}
		<div class="flex grow flex-col gap-4">
			{#if layout.sidebarConfig === 'slack'}
				<Slack {project} inline />
			{:else if layout.sidebarConfig === 'chatbot'}
				<ChatBot {project} />
			{:else}
				<div class="p-8">
					{@render underConstruction()}
				</div>
			{/if}
		</div>
	{:else if layout.sidebarConfig === 'system-prompt'}
		<div class="flex w-full flex-col">
			<div class="dark:border-surface2 flex flex-col border-b border-transparent px-8 py-4">
				<button
					onclick={() => closeSidebarConfig(layout)}
					class="flex w-fit items-center gap-1 rounded-full pr-6 text-base font-medium"
				>
					<ChevronsLeft class="size-6" /> Go Back
				</button>
			</div>
			<div
				class="dark:from-surface1 to-surface1 flex grow flex-col gap-4 bg-radial-[at_25%_25%] from-white to-75% p-8 shadow-inner dark:to-black"
			>
				<div class="text-md flex flex-col gap-2">
					<h3 class="text-xl font-semibold">System Prompt</h3>
					<p class="text-md mb-4 font-light text-gray-500">
						Describe your agent's personality, goals, and any other relevant information.
					</p>

					<textarea
						id="project-instructions"
						class="dark:border-surface3 grow resize-none rounded-lg bg-white p-4 shadow-sm dark:border dark:bg-black"
						rows="12"
						use:autoHeight
						bind:value={project.prompt}
					></textarea>
				</div>
			</div>
		</div>
	{:else if layout.sidebarConfig === 'members'}
		<Members {project} />
	{:else if layout.sidebarConfig === 'knowledge'}
		<Knowledge {assistant} {project} {currentThreadID} />
	{:else if layout.sidebarConfig === 'custom-tool' && layout.customToolId && toEdit}
		{#key layout.customToolId}
			<CustomTool
				bind:tool={toEdit}
				{project}
				onSave={async (tool) => {
					projectTools.tools = projectTools.tools.map((t) => (t.id === tool.id ? tool : t));
				}}
				onDelete={async (tool) => {
					projectTools.tools = projectTools.tools.filter((t) => t.id !== tool.id);
					closeSidebarConfig(layout);
				}}
			/>
		{/key}
	{/if}
</div>

{#snippet tabs(tabs: { label: string; value: string }[])}
	<div
		class="text-md border-surface2 sticky top-0 left-0 mb-8 flex w-xs flex-shrink-0 flex-col border-r-1 px-8 font-light"
	>
		<button
			onclick={() => closeSidebarConfig(layout)}
			class="mb-4 flex w-full items-center gap-1 py-4 text-base font-medium"
		>
			<ChevronsLeft class="size-6" /> Go Back
		</button>
		{#each tabs as tab}
			<button
				class={twMerge(
					'border-l-4 border-transparent px-4 py-2 text-left',
					layout.sidebarConfig === tab.value && 'border-blue-500'
				)}
				onclick={() => (layout.sidebarConfig = tab.value as Layout['sidebarConfig'])}
			>
				{tab.label}
			</button>
		{/each}
	</div>
{/snippet}

{#snippet underConstruction()}
	<div class="flex w-full flex-col items-center justify-center font-light">
		<img src="/user/images/under-construction.webp" alt="under construction" class="size-32" />
		<p class="text-sm font-light text-gray-500">
			This section is under construction. Please check back later.
		</p>
	</div>
{/snippet}
