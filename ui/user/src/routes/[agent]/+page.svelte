<script lang="ts">
	import { profile, term } from '$lib/stores';
	import Navbar from '$lib/components/Navbar.svelte';
	import Editor from '$lib/components/Editors.svelte';
	import { EditorService } from '$lib/services';
	import Notifications from '$lib/components/Notifications.svelte';
	import { currentAssistant } from '$lib/stores';
	import Thread from '$lib/components/Thread.svelte';

	const editorVisible = EditorService.visible;
	const editorMaxSize = EditorService.maxSize;

	let title = $derived($currentAssistant.name ?? '');
	let splitWindow = $derived(editorVisible && !$editorMaxSize);

	$effect(() => {
		if ($profile.unauthorized) {
			window.location.href = '/oauth2/start?rd=' + window.location.pathname;
		}
	});
</script>

<svelte:head>
	{#if title}
		<title>{title}</title>
	{/if}
</svelte:head>

<Navbar />

<main id="main-content" class="flex">
	<!-- overflow-auto is here only because when I remove it this pane won't disappear when the editor is max screen. Who knows... CSS sucks. -->
	<!-- these divs suck, but it's so that we have a relative container for the absolute input and the scrollable area is the entire screen and not just
			 the center content. Plus the screen will auto resize as the editor is resized -->
	<div class="relative flex-1 overflow-auto">
		<Thread assistant={$currentAssistant} />
	</div>

	{#if $editorVisible || term.open}
		<div class="h-dvh w-full pt-20 transition-all {splitWindow ? 'lg:w-3/4' : ''}">
			<div class="mx-auto h-full max-w-[1300px]">
				<Editor />
			</div>
		</div>
	{/if}

	<Notifications />
</main>
