<script lang="ts">
	import OptionLabel from './OptionLabel.svelte';
	import { X } from '@lucide/svelte';
	import type { Component, Snippet } from 'svelte';
	import { twMerge } from 'tailwind-merge';

	interface Props {
		label: string;
		id: string;
		description?: string;
		icon?: string | Component | Snippet;
		checked: boolean;
		onChange: (id: string, checked: boolean) => void;
		onRemove?: () => void;
	}

	let {
		label,
		id,
		description,
		icon,
		checked = $bindable(),
		onChange = $bindable(),
		onRemove = $bindable()
	}: Props = $props();

	const inputId = $derived(`checkbox-option-${id}`);
	const descriptionId = $derived(`${inputId}-description`);
</script>

<div class="col-span-12 @lg:col-span-6 flex items-stretch gap-1">
	<div
		class="bg-base-200 hover:bg-base-200/50 items-center flex min-w-0 flex-1 cursor-pointer gap-3 rounded-lg border border-transparent has-checked:border-primary has-checked:bg-primary/10"
	>
		<label for={inputId} class="flex items-start gap-1.5 grow p-3">
			<input
				id={inputId}
				type="checkbox"
				name="selected-mcp-categories"
				value={id}
				{checked}
				class={twMerge('checkbox checkbox-sm mt-0.5 shrink-0', checked ? 'checkbox-primary' : '')}
				aria-describedby={descriptionId}
				onchange={(event) => {
					onChange(id, (event.target as HTMLInputElement).checked);
				}}
			/>
			<OptionLabel {label} {description} {descriptionId} {icon} />
		</label>
		{#if onRemove}
			<button
				type="button"
				class="mr-2 btn btn-ghost btn-square btn-xs text-muted-content shrink-0 self-center"
				aria-label="Remove {label}"
				onclick={onRemove}
			>
				<X class="size-4" />
			</button>
		{/if}
	</div>
</div>
