<script lang="ts">
	import Threads from '$lib/components/nanobot/Threads.svelte';
	import { ChatAPI } from '$lib/services/nanobot/chat/index.svelte';
	import { nanobotChat } from '$lib/stores/nanobotChat.svelte';
	import { goto } from '$lib/url';

	interface Props {
		chatApi: ChatAPI;
		projectId: string;
	}

	let { chatApi }: Props = $props();

	async function handleRenameThread(threadId: string, newTitle: string) {
		try {
			await chatApi.renameThread(threadId, newTitle);
			const threadIndex = $nanobotChat?.threads.findIndex((t) => t.id === threadId) ?? -1;
			if (threadIndex !== -1 && $nanobotChat) {
				$nanobotChat.threads[threadIndex].title = newTitle;
			}
		} catch (error) {
			console.error('Failed to rename thread:', error);
		}
	}

	async function handleDeleteThread(threadId: string) {
		try {
			await chatApi.deleteThread(threadId);
			if ($nanobotChat) {
				$nanobotChat.threads = $nanobotChat.threads.filter((t) => t.id !== threadId);
			}

			if ($nanobotChat?.threadId === threadId) {
				$nanobotChat.threadId = undefined;
				goto(`/nanobot`);
			}
		} catch (error) {
			console.error('Failed to delete thread:', error);
		}
	}
</script>

<div class="flex-1">
	<div class="flex h-full flex-col">
		<!-- Threads section (takes up ~40% of available space) -->
		<div class="flex-shrink-0">
			<Threads
				threads={$nanobotChat?.threads ?? []}
				onRename={handleRenameThread}
				onDelete={handleDeleteThread}
				isLoading={$nanobotChat?.isThreadsLoading ?? false}
			/>
		</div>
	</div>
</div>
