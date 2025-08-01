<script lang="ts">
	import { tooltip } from '$lib/actions/tooltip.svelte';
	import { stripMarkdownToText } from '$lib/markdown';
	import type { MCPCatalogServer, MCPCatalogEntry } from '$lib/services';
	import { parseCategories } from '$lib/services/chat/mcp';
	import { Server, TriangleAlert, Unplug } from 'lucide-svelte';
	import type { Snippet } from 'svelte';
	import { twMerge } from 'tailwind-merge';

	interface Props {
		data:
			| MCPCatalogServer
			| MCPCatalogEntry
			| (MCPCatalogServer & { categories: string[] })
			| (MCPCatalogEntry & { categories: string[] });
		onClick: () => void;
		action?: Snippet;
	}

	let { data, onClick, action }: Props = $props();
	let icon = $derived(data.manifest.icon);
	let name = $derived(data.manifest.name);
	let categories = $derived('categories' in data ? data.categories : parseCategories(data));
	let needsUpdate = $derived(!('isCatalogEntry' in data) ? !data.configured : false);
</script>

<div class="relative flex flex-col">
	<button
		class={twMerge(
			'dark:bg-surface1 dark:border-surface3 flex h-full w-full flex-col rounded-sm border border-transparent bg-white p-3 text-left shadow-sm',
			needsUpdate &&
				'border-yellow-500 bg-yellow-50/20 dark:border-yellow-500 dark:bg-yellow-500/20'
		)}
		onclick={onClick}
	>
		<div class="flex items-center gap-2 pr-6">
			<div
				class="flex size-8 flex-shrink-0 items-center justify-center self-start rounded-md bg-transparent p-0.5 dark:bg-gray-600"
			>
				{#if icon}
					<img src={icon} alt={name} />
				{:else}
					<Server />
				{/if}
			</div>
			<div class="flex max-w-[calc(100%-2rem)] flex-col">
				<p class="text-sm font-semibold">{name}</p>
				<span
					class={twMerge(
						'text-xs leading-4.5 font-light text-gray-400 dark:text-gray-600',
						categories.length > 0 ? 'line-clamp-2' : 'line-clamp-3'
					)}
				>
					{stripMarkdownToText(data.manifest.description ?? '')}
				</span>
			</div>
		</div>
		<div class="flex w-full flex-wrap gap-1 pt-2">
			{#each categories as category (category)}
				<div
					class="border-surface3 rounded-full border px-1.5 py-0.5 text-[10px] font-light text-gray-400 dark:text-gray-600"
				>
					{category}
				</div>
			{/each}
		</div>
	</button>
	<div class="absolute -top-2 right-0 flex h-full translate-y-2 flex-col justify-between gap-4 p-2">
		{#if action}
			{@render action()}
		{:else}
			<button
				class="icon-button hover:bg-surface1 dark:hover:bg-surface2 size-6 min-h-auto min-w-auto flex-shrink-0 p-1 hover:text-blue-500"
				use:tooltip={'Connect to server'}
				onclick={onClick}
			>
				<Unplug class="size-4" />
			</button>
		{/if}
	</div>
	{#if needsUpdate}
		<div
			class="absolute -top-1 right-7 flex h-full translate-y-2 flex-col justify-between gap-4 p-2"
			use:tooltip={'Server requires an update.'}
		>
			<TriangleAlert class="size-4 text-yellow-500" />
		</div>
	{/if}
</div>
