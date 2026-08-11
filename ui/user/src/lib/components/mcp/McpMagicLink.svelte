<script lang="ts">
	import type { Snippet } from 'svelte';
	import { twMerge } from 'tailwind-merge';

	interface Props {
		class?: string;
		icon?: string;
		iconDark?: string;
		alt: string;
		link: string;
		client: string;
		label?: Snippet;
	}

	let { icon, iconDark, alt, link, client, label, class: klass }: Props = $props();
</script>

<div
	id={`magic-link-${client.toLowerCase()}-container`}
	class={twMerge(
		'rounded-field bg-base-200 shadow-inner border-none input gap-0 w-full px-0 overflow-y-hidden',
		klass
	)}
>
	<div
		class="rounded-l-field label w-43 px-2.5 flex items-center gap-2 text-xs text-base-content/75 shrink-0 ml-1 mr-0 bg-base-100 dark:bg-base-300"
	>
		{#if label}
			{@render label()}
		{:else}
			<img src={iconDark ?? icon} alt={`${alt} branding icon`} class="size-4 dark:block hidden" />
			<img src={icon} alt={`${alt} branding icon`} class="size-4 block dark:hidden" />
			{alt}
		{/if}
	</div>
	<div class="grow flex mr-1 relative">
		<a
			id={`magic-link-${client.toLowerCase()}`}
			href={link}
			rel="noopener noreferrer external"
			class="h-8 flex gap-2 justify-center font-mono uppercase items-center text-xs btn btn-secondary hover:bg-primary hover:text-primary-content mx-2 grow"
		>
			<img src={iconDark ?? icon} alt={`${alt} branding icon`} class="size-4 dark:block hidden" />
			<img src={icon} alt={`${alt} branding icon`} class="size-4 block dark:hidden" />
			Add to {alt}
		</a>
	</div>
</div>
