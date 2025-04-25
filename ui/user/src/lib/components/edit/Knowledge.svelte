<script lang="ts">
	import { ChatService, type Assistant, type Project } from '$lib/services';
	import { type KnowledgeFile as KnowledgeFileType } from '$lib/services';
	import KnowledgeFile from '$lib/components/navbar/KnowledgeFile.svelte';
	import { ChevronsLeft, Plus, Trash2 } from 'lucide-svelte';
	import { closeSidebarConfig, getLayout, openSidebarConfig } from '$lib/context/layout.svelte';
	import { autoHeight } from '$lib/actions/textarea';
	import KnowledgeUpload from '../navbar/KnowledgeUpload.svelte';

	interface Props {
		project: Project;
		currentThreadID?: string;
		assistant?: Assistant;
	}

	let { project, currentThreadID = $bindable(), assistant }: Props = $props();
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

	async function loadFiles() {
		if (!currentThreadID) {
			return;
		}
		knowledgeFiles = (
			await ChatService.listKnowledgeFiles(project.assistantID, project.id, {
				threadID: currentThreadID
			})
		).items;
	}

	async function remove(file: KnowledgeFileType) {
		await ChatService.deleteKnowledgeFile(project.assistantID, project.id, file.fileName);
		return reload();
	}
</script>

<div class="flex w-full flex-col">
	<div class="dark:border-surface2 flex flex-col border-b border-transparent px-8 py-4">
		<button
			onclick={() => closeSidebarConfig(layout)}
			class="flex w-fit items-center gap-1 rounded-full pr-6 text-base font-medium"
		>
			<ChevronsLeft class="size-6" /> Go Back
		</button>
	</div>
	<div
		class="dark:from-surface1 to-surface1 flex grow flex-col gap-8 bg-radial-[at_25%_25%] from-white to-75% p-8 shadow-inner dark:to-black"
	>
		<div class="flex flex-col gap-2">
			<h3 class="text-xl font-semibold">Knowledge</h3>
			<p class="text-md font-light text-gray-500">
				Add files or websites to your agent's knowledge base.
			</p>
		</div>

		<div class="flex flex-col gap-4">
			<div class="flex w-full items-center justify-between gap-4">
				<h4 class="text-lg font-semibold">Files</h4>
				<KnowledgeUpload onUpload={loadFiles} {project} thread {currentThreadID} />
			</div>

			{#if knowledgeFiles.length > 0}
				<div class="flex flex-col gap-4">
					{#each knowledgeFiles as file}
						{#key file.fileName}
							<KnowledgeFile {file} onDelete={() => remove(file)} />
						{/key}
					{/each}
				</div>
			{/if}
		</div>

		{#if assistant?.websiteKnowledge?.siteTool}
			<div class="flex flex-col gap-4">
				<h4 class="text-lg font-semibold">Websites</h4>
				{@render websiteKnowledgeList()}
			</div>
		{/if}
	</div>
</div>

{#snippet websiteKnowledgeList()}
	<div class="flex flex-col gap-2">
		{#if project.websiteKnowledge?.sites}
			<table class="w-full text-left">
				<thead class="text-sm">
					<tr>
						<th class="font-light">Website Address</th>
						<th class="font-light">Description</th>
					</tr>
				</thead>
				<tbody>
					{#each project.websiteKnowledge.sites as _, i (i)}
						<tr class="group">
							<td>
								<input
									bind:value={project.websiteKnowledge.sites[i].site}
									placeholder="example.com"
									class="ghost-input border-surface2 w-3/4"
								/>
							</td>
							<td>
								<textarea
									class="ghost-input border-surface2 w-5/6 resize-none"
									bind:value={project.websiteKnowledge.sites[i].description}
									rows="1"
									placeholder="Description"
									use:autoHeight
								></textarea>
							</td>
							<td class="flex justify-end">
								<button
									class="icon-button"
									onclick={() => {
										project.websiteKnowledge?.sites?.splice(i, 1);
									}}
								>
									<Trash2 class="size-5" />
								</button>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}
		<div class="self-end">
			<button
				class="button-small"
				onclick={() => {
					if (!project.websiteKnowledge) {
						project.websiteKnowledge = {
							sites: [{}]
						};
					} else if (!project.websiteKnowledge.sites) {
						project.websiteKnowledge.sites = [{}];
					} else {
						project.websiteKnowledge.sites.push({});
					}
				}}
			>
				<Plus class="size-4" />
				Website
			</button>
		</div>
	</div>
{/snippet}
