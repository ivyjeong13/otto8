<script lang="ts">
	import { ChatService, type Project } from '$lib/services';
	import { type KnowledgeFile as KnowledgeFileType } from '$lib/services';
	import KnowledgeFile from '$lib/components/navbar/KnowledgeFile.svelte';
	import { Link, Settings, Trash2 } from 'lucide-svelte';
	import { getLayout, openSidebarConfig } from '$lib/context/layout.svelte';

	interface Props {
		project: Project;
	}

	let { project }: Props = $props();
	let knowledgeFiles = $state<KnowledgeFileType[]>([]);
	const layout = getLayout();
	$effect(() => {
		if (project) {
			reload();
		}
	});

	async function reload() {
		knowledgeFiles = (await ChatService.listKnowledgeFiles(project.assistantID, project.id)).items;
		const pending = knowledgeFiles.find(
			(file) => file.state === 'pending' || file.state === 'ingesting'
		);
		if (pending) {
			setTimeout(reload, 2000);
		}
	}

	async function remove(file: KnowledgeFileType) {
		await ChatService.deleteKnowledgeFile(project.assistantID, project.id, file.fileName);
		return reload();
	}
</script>

<div class="flex flex-col gap-2" id="sidebar-knowledge">
	<div class="mb-1 flex items-center justify-between">
		<p class="grow text-sm font-semibold">Knowledge</p>
		<button class="icon-button" onclick={() => openSidebarConfig(layout, 'knowledge')}>
			<Settings class="size-5" />
		</button>
	</div>
	<div class="flex flex-col gap-4">
		<div class="flex flex-col gap-2 pr-2.5">
			{#each knowledgeFiles as file}
				{#key file.fileName}
					<KnowledgeFile {file} onDelete={() => remove(file)} />
				{/key}
			{/each}
			{#if project.websiteKnowledge?.sites}
				{#each project.websiteKnowledge.sites as _, i (i)}
					<div class="group flex w-full min-w-0 items-center gap-2">
						<Link class="flex size-4 flex-shrink-0" />
						<div class="flex min-w-0 flex-1 flex-col">
							<span class="truncate text-xs">{project.websiteKnowledge.sites[i].site}</span>
							<span class="text-xs text-gray-500">
								{project.websiteKnowledge.sites[i].description}
							</span>
						</div>
						<button
							class="flex-shrink-0 px-0.5 opacity-0 transition-all duration-200 group-hover:opacity-100"
							onclick={() => {
								project.websiteKnowledge?.sites?.splice(i, 1);
							}}
						>
							<Trash2 class="text-gray size-4" />
						</button>
					</div>
				{/each}
			{/if}
		</div>
	</div>
</div>
