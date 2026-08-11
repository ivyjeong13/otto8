<script lang="ts">
	import { stripMarkdownToText } from '$lib/markdown';
	import { isIconSnippet } from './isIconSnippet';
	import type { Component, Snippet } from 'svelte';

	type IconComponent = Component<{ class?: string; 'aria-hidden'?: boolean }>;

	interface Props {
		icon?: string | IconComponent | Snippet;
		label: string;
		description?: string;
		descriptionId: string;
	}

	let { label, description, descriptionId, icon }: Props = $props();
</script>

<span class="flex min-w-0 flex-col gap-0.5 translate-y-0.5">
	<span class="flex items-center gap-1 text-sm font-medium">
		{#if typeof icon === 'string'}
			<img src={icon} alt="" class="size-5 shrink-0 object-contain icon" aria-hidden="true" />
		{:else if icon && isIconSnippet(icon)}
			{@render icon()}
		{:else if icon}
			{@const Icon = icon}
			<Icon class="size-4 shrink-0" aria-hidden={true} />
		{/if}
		{label}
	</span>
	{#if description}
		<span id={descriptionId} class="text-muted-content text-xs line-clamp-2">
			{@html stripMarkdownToText(description)}
		</span>
	{/if}
</span>
