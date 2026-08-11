<script lang="ts">
	import { Circle, CircleCheckBig } from '@lucide/svelte';
	import { twMerge } from 'tailwind-merge';

	interface Props {
		label: string;
		completed: boolean;
	}
	let { label, completed }: Props = $props();
</script>

<li class="text-sm font-light not-last:pr-4">
	<span
		class={twMerge('flex gap-1.5 items-center', completed ? 'text-primary' : 'text-muted-content')}
	>
		{#if completed}
			<CircleCheckBig class="size-3 shrink-0" />
		{:else}
			<Circle class="size-3 shrink-0" />
		{/if}
		{label}
	</span>
</li>
