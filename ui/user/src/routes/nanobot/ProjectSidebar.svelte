<script lang="ts">
	import Threads from '$lib/components/nanobot/Threads.svelte';
	import { ChatAPI } from '$lib/services/nanobot/chat/index.svelte';
	import { nanobotChat } from '$lib/stores/nanobotChat.svelte';
	import { goto } from '$lib/url';

	interface Props {
		chatApi: ChatAPI;
	}

	let { chatApi }: Props = $props();

	async function handleRenameThread(threadId: string, newTitle: string) {
		try {
			await chatApi.renameThread(threadId, newTitle);
			const threadIndex = $nanobotChat?.threads.findIndex((t) => t.id === threadId) ?? -1;
			if (threadIndex !== -1 && $nanobotChat) {
				nanobotChat.update((data) => {
					if (data && threadIndex !== -1) {
						data.threads[threadIndex].title = newTitle;
					}
					return data;
				});
			}
		} catch (error) {
			console.error('Failed to rename thread:', error);
		}
	}

	async function handleDeleteThread(threadId: string) {
		const isCurrentViewedThread = $nanobotChat?.threadId === threadId;
		try {
			await chatApi.deleteThread(threadId);
			if ($nanobotChat) {
				nanobotChat.update((data) => {
					if (data) {
						data.threads = data.threads.filter((t) => t.id !== threadId);
						if (data.threadId === threadId) {
							data.threadId = undefined;
						}
					}
					return data;
				});
			}

			if (isCurrentViewedThread) {
				goto(`/nanobot`, { replaceState: true });
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
