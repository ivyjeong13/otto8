<script lang="ts">
	import { Eye, EyeOff } from 'lucide-svelte';

	interface Props {
		name: string;
		value?: string;
	}

	let { name, value = $bindable('') }: Props = $props();
	let showSensitive = $state(false);
	let focused = $state(false);
	let fakeValue = $derived(value.length > 0 ? '************************' : '');

	function handleInput(event: Event) {
		const input = event.target as HTMLInputElement;
		if (input.value !== fakeValue) {
			value = input.value;
		}
	}

	function toggleVisibility() {
		showSensitive = !showSensitive;
	}
</script>

<div class="relative flex grow items-center">
	<input
		data-1p-ignore
		id={name}
		{name}
		class="text-input-filled w-full pr-10"
		value={showSensitive || focused ? value : fakeValue}
		type={showSensitive ? 'text' : 'password'}
		oninput={handleInput}
		onfocus={() => (focused = true)}
		onblur={() => (focused = false)}
	/>

	<button
		class="absolute top-1/2 right-4 z-10 -translate-y-1/2 cursor-pointer"
		onclick={toggleVisibility}
	>
		{#if showSensitive}
			<EyeOff class="size-4" />
		{:else}
			<Eye class="size-4" />
		{/if}
	</button>
</div>
