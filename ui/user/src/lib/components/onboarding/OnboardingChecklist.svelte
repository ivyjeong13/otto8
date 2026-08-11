<script lang="ts">
	import { PAGE_TRANSITION_DURATION } from '$lib/constants';
	import { responsive } from '$lib/stores';
	import Step from './Step.svelte';
	import { fade } from 'svelte/transition';

	interface Props {
		step: number;
		selectedUsageOption?: string;
		show: boolean;
	}
	let { step, selectedUsageOption, show }: Props = $props();
</script>

{#if !responsive.isMobile && show}
	<ul
		in:fade={{ duration: PAGE_TRANSITION_DURATION }}
		class="flex gap-4 divide-x divide-muted-content"
	>
		{#if selectedUsageOption === 'curate'}
			<!-- curate -->
			<Step label="MCP Servers & Skills" completed={step > 0} />
			<Step label="Access Policies" completed={step > 1} />
			<Step label="Connect AI Client" completed={step > 2} />
		{:else if selectedUsageOption === 'monitor'}
			<!-- monitor -->
			<Step label="Select OS" completed={step > 0} />
			<Step label="Install Obot Sentry" completed={step > 1} />
		{:else}
			<!-- connect gmail/outlook-->
			<Step label="AI Client" completed={step > 0} />
			{#if selectedUsageOption === 'organize-day-gmail'}
				<Step label="Connect Gmail & Google Calendar" completed={step > 1} />
			{:else}
				<Step label="Connect Outlook" completed={step > 1} />
			{/if}
			<Step label="Organize Day" completed={step >= 2} />
		{/if}
	</ul>
{/if}
