<script lang="ts">
	import { darkMode, errors } from '$lib/stores';
	import { initLayout } from '$lib/context/nanobotLayout.svelte';
	import { NanobotService } from '$lib/services';
	import { initializeNanobot } from './initializeNanobot';
	import 'devicon/devicon.min.css';
	import { onMount } from 'svelte';

	let { children, data } = $props();

	// Initialize layout context for all nanobot child routes
	initLayout();

	let loading = $state(true);
	let projects = $derived(data.projects);
	let agent = $derived(data.agent);
	let isNewAgent = $derived(data.isNewAgent);

	let cleanup: (() => void) | undefined;
	onMount(() => {
		(async () => {
			loading = true;
			if (isNewAgent && projects?.length && agent) {
				try {
					await NanobotService.launchProjectV2Agent(projects[0].id, agent.id);
				} catch (error) {
					console.error(error);
					errors.append(error);
				} finally {
					loading = false;
				}
			} else {
				loading = false;
			}

			if (agent && projects?.length) {
				cleanup = await initializeNanobot(agent.connectURL, projects[0].id);
			}
		})();
		return () => cleanup?.();
	});
</script>

<div class="nanobot" data-theme={darkMode.isDark ? 'nanobotdark' : 'nanobotlight'}>
	{#if loading}
		<span class="loading loading-spinner loading-lg text-primary"></span>
	{:else}
		{@render children()}
	{/if}
</div>
