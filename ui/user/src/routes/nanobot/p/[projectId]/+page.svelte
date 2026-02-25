<script lang="ts">
	import ProjectStartThread from '$lib/components/nanobot/ProjectStartThread.svelte';
	import { getContext } from 'svelte';
	import type { ProjectLayoutContext } from '$lib/services/nanobot/types';
	import { PROJECT_LAYOUT_CONTEXT } from '$lib/services/nanobot/types';
	import { page } from '$app/state';
	import { ChatService } from '$lib/services/nanobot/chat/index.svelte';
	import * as nanobotLayout from '$lib/context/nanobotLayout.svelte';
	import { nanobotChat } from '$lib/stores/nanobotChat.svelte';
	import { get } from 'svelte/store';
	import { untrack } from 'svelte';

	let { data } = $props();
	let agent = $derived(data.agent);
	let projectId = $derived(data.projectId);
	let threadId = $derived(page.url.searchParams.get('tid') ?? undefined);
	let prevThreadId: string | null | undefined = undefined;
	let needsRefreshThreads = $state(true);
	let initialQuickBarAccessOpen = $state(false);
	let chat = $state<ChatService | null>(null);

	const projectLayout = getContext<ProjectLayoutContext>(PROJECT_LAYOUT_CONTEXT);
	const layout = nanobotLayout.getLayout();

	$effect(() => {
		if (initialQuickBarAccessOpen || !threadId) return;
		if (chat && chat.messages.length > 0) {
			let foundTool = false;
			for (const message of chat.messages) {
				if (message.role !== 'assistant') continue;
				for (const item of message.items || []) {
					if (item.type === 'tool' && (item.name === 'todoWrite' || item.name === 'write')) {
						initialQuickBarAccessOpen = true;

						if (!layout.quickBarAccessOpen) {
							layout.quickBarAccessOpen = true;
						}

						foundTool = true;
						break;
					}
				}
				if (foundTool) break;
			}
		}
	});

	async function loadThreads() {
		const threads = await get(nanobotChat)?.api.getThreads();
		nanobotChat.update((data) => {
			if (data) {
				data.threads = threads ?? [];
			}
			return data;
		});
	}

	$effect(() => {
		if (chat && chat.messages.length >= 2 && needsRefreshThreads) {
			const tid = chat.chatId;
			const inThreads = $nanobotChat?.threads.find((t) => t.id === tid);
			if (!inThreads) {
				loadThreads();
			}

			needsRefreshThreads = false;
		}
	});

	$effect(() => {
		const currentThreadId = threadId;
		const currentProjectId = projectId;

		const shouldSkip = untrack(
			() => prevThreadId !== undefined && currentThreadId === prevThreadId
		);
		if (shouldSkip) return;

		const storedChat = get(nanobotChat);
		const sameProject = storedChat?.projectId === currentProjectId && storedChat?.chat;
		const threadMatches = storedChat?.threadId === currentThreadId;

		if (sameProject && threadMatches) {
			console.log('reusing stored thread', currentThreadId, storedChat?.threadId);
			untrack(() => {
				prevThreadId = currentThreadId;
				chat = storedChat!.chat!;
			});
			return () => {};
		}

		untrack(() => {
			prevThreadId = currentThreadId;
			chat?.close();
		});

		const newChat = new ChatService({
			baseUrl: agent.connectURL,
			skipInitialResources: !!currentThreadId,
			chatId: currentThreadId
		});

		untrack(() => {
			console.log('creating new chat', currentThreadId);
			chat = newChat;
			nanobotChat.update((data) => {
				if (data) {
					data.chat = newChat;
					data.threadId = currentThreadId ?? undefined;
				}
				return data;
			});
		});

		return () => {
			untrack(() => {
				if (chat !== newChat) {
					newChat.close();
				}
			});
		};
	});
</script>

{#if projectLayout.chat}
	{#key projectLayout.chat}
		<ProjectStartThread
			agentId={agent.id}
			{projectId}
			chat={projectLayout.chat}
			onFileOpen={projectLayout.handleFileOpen}
			suppressEmptyState
			onThreadContentWidth={projectLayout.setThreadContentWidth}
		/>
	{/key}
{/if}
