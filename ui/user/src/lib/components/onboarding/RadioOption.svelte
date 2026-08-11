<script lang="ts">
	import LogoIcon from '$lib/icons/LogoIcon.svelte';
	import OptionLabel from './OptionLabel.svelte';
	import type { Component, Snippet } from 'svelte';
	import { twMerge } from 'tailwind-merge';

	interface Props {
		checked: boolean;
		onChange: (id: string) => void;
		icon?: Snippet | string | Component;
		label: string;
		id: string;
		description?: string;
		includeObot?: boolean;
	}

	let {
		label,
		id,
		description,
		icon,
		includeObot = false,
		checked = $bindable(),
		onChange = $bindable()
	}: Props = $props();

	const inputId = $derived(`radio-option-${id}`);
	const descriptionId = $derived(`${inputId}-description`);
</script>

<label for={inputId} class="col-span-12 block cursor-pointer @lg:col-span-6">
	<input
		id={inputId}
		type="radio"
		name="usage-option"
		value={id}
		{checked}
		class="peer sr-only"
		aria-describedby={descriptionId}
		onchange={() => {
			onChange(id);
		}}
	/>
	<span
		class="bg-base-200 h-full hover:bg-base-200/50 relative flex w-full items-start gap-1.5 overflow-hidden rounded-lg border border-transparent p-3 peer-checked:border-primary peer-checked:bg-primary/10"
		class:pr-8={includeObot}
	>
		<OptionLabel {label} {description} {descriptionId} {icon} />
		{#if includeObot}
			<span
				class={twMerge(
					'obot-peek opacity-10 transition-colors text-muted-content',
					checked && 'text-primary opacity-25'
				)}
				class:obot-peek-in={checked}
				aria-hidden="true"
			>
				<LogoIcon class="size-32" />
			</span>
		{/if}
	</span>
</label>

<style>
	.obot-peek {
		pointer-events: none;
		position: absolute;
		top: -1.5rem;
		right: -1.5rem;
		transform: translate(72%, -58%) rotate(46deg);
		transform-origin: 0% 100%;
		transition: transform 250ms cubic-bezier(0.55, 0.05, 0.67, 0.2);
	}

	label:hover .obot-peek,
	label:has(:checked) .obot-peek,
	.obot-peek-in {
		transform: translate(40%, 22%) rotate(-15deg);
		transition: transform 350ms cubic-bezier(0.22, 1.45, 0.32, 1);
	}

	@media (prefers-reduced-motion: reduce) {
		.obot-peek,
		label:hover .obot-peek,
		label:has(:checked) .obot-peek,
		.obot-peek-in {
			transition: none;
		}
	}
</style>
