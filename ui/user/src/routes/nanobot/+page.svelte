<script lang="ts">
	import Layout from '$lib/components/Layout.svelte';
	import * as nanobotLayout from '$lib/context/nanobotLayout.svelte';
	import ProjectSidebar from './ProjectSidebar.svelte';
	import { ChatService } from '$lib/services/nanobot/chat/index.svelte';
	import { untrack } from 'svelte';
	import ProjectStartThread from '$lib/components/nanobot/ProjectStartThread.svelte';
	import type { Chat } from '$lib/services/nanobot/types';
	import { goto } from '$lib/url';
	import { get } from 'svelte/store';
	import { nanobotChat } from '$lib/stores/nanobotChat.svelte';
	import ThreadQuickAccess from '$lib/components/nanobot/QuickAccess.svelte';

	let { data } = $props();
	let projects = $derived(data.projects);
	let agent = $derived(data.agent);
	let chat = $state<ChatService | null>(null);
	let threadContentWidth = $state(0);

	function handleThreadCreated(thread: Chat) {
		const projectId = projects[0].id;
		if (chat) {
			nanobotChat.update((data) => {
				if (data) {
					data.chat = chat!;
					data.threadId = thread.id;
				}
				return data;
			});
		}
		goto(`/nanobot/p/${projectId}?tid=${thread.id}`, {
			replaceState: true,
			noScroll: true,
			keepFocus: true
		});
	}

	$effect(() => {
		// Track store so effect re-runs when loadNanobotThreads populates it in onMount
		const stored = get(nanobotChat);

		untrack(() => {
			const newChat = new ChatService({
				baseUrl: agent.connectURL,
				onThreadCreated: handleThreadCreated
			});

			chat = newChat;
			// Sync chat into store only after loadNanobotThreads has run (store created in onMount)
			if (stored) {
				nanobotChat.update((data) => {
					if (data) {
						data.chat = newChat;
						data.threadId = undefined;
					}
					return data;
				});
			}
		});

		return () => {
			const storedChat = get(nanobotChat);
			if (storedChat?.chat) {
				storedChat.chat.close();
			}
		};
	});
</script>

<Layout
	title=""
	layoutContext={nanobotLayout}
	classes={{
		container: 'px-0 py-0 md:px-0',
		childrenContainer: 'max-w-full h-[calc(100dvh-4rem)]',
		collapsedSidebarHeaderContent: 'pb-0',
		sidebar: 'pt-0 px-0',
		sidebarRoot: 'bg-base-200'
	}}
	whiteBackground
	disableResize
	hideProfileButton
>
	{#snippet leftSidebar()}
		<ProjectSidebar projectId={projects[0].id} />
	{/snippet}

	<div
		class="flex w-full min-w-0 grow"
		style={threadContentWidth > 0 ? `min-width: ${threadContentWidth}px` : ''}
	>
		{#if chat}
			{#key chat.chatId}
				<ProjectStartThread
					agentId={agent.id}
					projectId={projects[0].id}
					{chat}
					onThreadContentWidth={(w) => (threadContentWidth = w)}
				/>
			{/key}
		{/if}
	</div>

	{#snippet rightSidebar()}
		{#if chat}
			<ThreadQuickAccess />
		{/if}
	{/snippet}
</Layout>

<svelte:head>
	<title>Nanobot</title>
</svelte:head>
