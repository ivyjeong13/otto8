<script lang="ts">
	import type { Project } from '$lib/services';
	import { autoHeight } from '$lib/actions/textarea';
	import { Plus } from 'lucide-svelte/icons';
	import EditIcon from './EditIcon.svelte';
	import { Trash2 } from 'lucide-svelte';

	interface Props {
		project: Project;
	}

	let { project = $bindable() }: Props = $props();
</script>

<div class="w-full">
	<h4 class="dark:border-surface2 border-b border-transparent px-8 py-4 text-xl font-semibold">
		Introduction & Starter Messages
	</h4>
	<div
		class="from-surface1 dark:from-surface1 bg-radial-[at_25%_25%] to-white to-75% p-8 shadow-inner dark:to-black"
	>
		<div class="text-md flex w-full gap-4">
			<EditIcon bind:project inline />
			<div class="flex grow flex-col gap-4 pt-5">
				<div class="flex w-full flex-col gap-1">
					<label for="project-name" class="font-semibold">Name</label>
					<input
						id="project-name"
						disabled={!project.editor}
						type="text"
						class="dark:border-surface3 grow rounded-lg bg-white p-2 shadow-sm dark:border dark:bg-black"
						bind:value={project.name}
					/>
				</div>
				<div class="flex w-full flex-col gap-1">
					<label for="project-desc" class="font-semibold">Description</label>
					<textarea
						id="project-desc"
						class="dark:border-surface3 grow resize-none rounded-lg bg-white p-2 shadow-sm dark:border dark:bg-black"
						disabled={!project.editor}
						rows="1"
						placeholder="A small blurb or tagline summarizing your agent"
						use:autoHeight
						bind:value={project.description}
					></textarea>
				</div>
				<div class="flex w-full flex-col gap-1">
					<label for="project-introduction" class="font-semibold">Introduction</label>
					<textarea
						id="project-introduction"
						class="dark:border-surface3 grow resize-none rounded-lg bg-white p-2 shadow-sm dark:border dark:bg-black"
						rows="5"
						placeholder="This will be your agent's go-to message."
						use:autoHeight
						bind:value={project.introductionMessage}
					></textarea>
				</div>
			</div>
		</div>

		<div class="flex flex-col gap-2 px-8 py-4">
			<h4 class="text-lg font-semibold">Starter Messages</h4>
			<p class="text-sm font-light text-gray-500">
				These messages are conversation options that are provided to the user. <br />
				Help break the ice with your agent by providing a few different options!
			</p>
		</div>

		<div class="flex w-full flex-col gap-4 px-8">
			{#each project.starterMessages?.keys() ?? [] as i}
				{#if project.starterMessages}
					<div class="flex gap-2">
						<textarea
							id="project-instructions"
							class="dark:border-surface3 border-surface1 grow resize-none rounded-lg border bg-white p-2 shadow-sm dark:bg-black"
							rows="1"
							use:autoHeight
							bind:value={project.starterMessages[i]}
						></textarea>
						<button
							class="icon-button"
							onclick={() =>
								(project.starterMessages = [
									...(project.starterMessages ?? []).slice(0, i),
									...(project.starterMessages ?? []).slice(i + 1)
								])}
						>
							<Trash2 class="size-4" />
						</button>
					</div>
				{/if}
			{/each}
		</div>
		<div class="flex justify-end p-8 pt-4">
			<button
				class="button flex items-center gap-1"
				onclick={() => (project.starterMessages = [...(project.starterMessages ?? []), ''])}
			>
				<Plus class="size-4" />
				<span class="text-sm">Starter Message</span>
			</button>
		</div>
	</div>
</div>
