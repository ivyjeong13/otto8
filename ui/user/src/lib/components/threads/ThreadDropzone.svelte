<script lang="ts">
	import { ChatService, type Project } from '$lib/services';
	import { Thread } from '$lib/services/chat/thread.svelte';
	import { knowledge } from '$lib/stores';
	import { X } from 'lucide-svelte';
	import FileDropzone from '../FileDropzone.svelte';
	import type { Snippet } from 'svelte';

	interface Props {
		project: Project;
		thread?: Thread;
		children: Snippet;
	}

	let { children, project, thread }: Props = $props();
	let knowledgeOptInFiles = $state<{ file: File; selected?: boolean }[]>([]);
	let knowledgeOptInDialog = $state<HTMLDialogElement>();

	function onFilesDrop(files: File[]) {
		knowledgeOptInFiles = files
			.filter(
				(file) =>
					file.name.toLowerCase().endsWith('.pdf') ||
					file.name.toLowerCase().endsWith('.txt') ||
					file.name.toLowerCase().endsWith('.pptx')
			)
			.map((file) => ({ file, selected: true }));

		if (knowledgeOptInFiles.length > 0) {
			knowledgeOptInDialog?.showModal();
		}

		files.forEach((file) =>
			ChatService.saveFile(project.assistantID, project.id, file, {
				threadID: thread?.threadID
			})
		);
	}
</script>

<FileDropzone
	{onFilesDrop}
	placeholder="Drop file here to add as knowledge."
	class="relative w-full"
>
	{@render children()}
</FileDropzone>

<dialog class="colors-surface1 min-w-[320px] rounded-3xl p-5" bind:this={knowledgeOptInDialog}>
	<div class="flex flex-col gap-4">
		<h2 class="font-semibold">Add Files to Knowledge?</h2>
		<div class="flex flex-col gap-2">
			<p>
				The following files can also be added to the agent's knowledge base. Please select which
				files you would like to add.
			</p>
			{#each knowledgeOptInFiles as file}
				<div class="flex items-center gap-2">
					<input
						type="checkbox"
						bind:checked={file.selected}
						onclick={() => (file.selected = !file.selected)}
					/>
					<span>{file.file.name}</span>
				</div>
			{/each}
		</div>
		<button class="absolute right-5 top-5" onclick={() => knowledgeOptInDialog?.close()}>
			<X class="icon-default" />
		</button>

		<div class="flex justify-between gap-2">
			<button
				class="button"
				onclick={() => {
					knowledgeOptInDialog?.close();
					knowledgeOptInFiles = [];
				}}>Skip</button
			>
			<button
				class="button"
				onclick={() => {
					knowledgeOptInDialog?.close();
					knowledgeOptInFiles.forEach(({ file, selected }) => {
						if (selected) {
							knowledge.addUploadingFile(file, project.assistantID, project.id);
						}
					});
					knowledgeOptInFiles = [];
				}}>Add</button
			>
		</div>
	</div>
</dialog>
