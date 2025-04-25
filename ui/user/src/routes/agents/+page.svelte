<script lang="ts">
	import type { PageProps } from './$types';
	import Navbar from '$lib/components/Navbar.svelte';
	import { darkMode, responsive } from '$lib/stores';
	import { formatTime } from '$lib/time';
	import { getProjectImage } from '$lib/image';
	import { Origami, Plus, Scroll, Trash2 } from 'lucide-svelte';
	import { ChatService, type Project } from '$lib/services';
	import Confirm from '$lib/components/Confirm.svelte';
	import { sortByFeaturedNameOrder } from '$lib/sort';
	import { clickOutside } from '$lib/actions/clickoutside';

	let { data }: PageProps = $props();

	let agents = $state<Project[]>(
		data.projects.sort((a, b) => {
			return new Date(b.created).getTime() - new Date(a.created).getTime();
		})
	);
	let toolsMap = $derived(new Map(data.tools.map((tool) => [tool.id, tool])));

	let toDelete = $state<Project>();
	let createDropdown = $state<HTMLDialogElement>();

	let featuredShares = $derived(data.shares.sort(sortByFeaturedNameOrder));
</script>

<div class="flex min-h-dvh flex-col items-center">
	<Navbar />
	<main
		class="bg-surface1 relative flex w-full grow flex-col items-center justify-center dark:bg-black"
	>
		<div class="flex w-full max-w-(--breakpoint-xl) grow flex-col gap-6 px-4 py-12">
			<div class="flex justify-between">
				<h1 class="text-2xl font-semibold">Agents</h1>
				<div class="relative flex items-center gap-4">
					<button
						class="button-primary flex items-center gap-1 text-sm"
						onclick={() => {
							createDropdown?.show();
						}}
					>
						<Plus class="size-6" /> Create New Agent
					</button>

					<dialog
						bind:this={createDropdown}
						class="absolute top-12 right-0 left-auto m-0 w-sm"
						use:clickOutside={() => {
							createDropdown?.close();
						}}
					>
						<div class="flex flex-col gap-2 p-2 pt-4">
							<p
								class="text-md border-surface2 dark:border-surface3 flex items-center gap-2 border-b px-2 pb-2 font-semibold"
							>
								<Origami class="size-4" /> Create From Template
							</p>
							<div class="flex flex-col gap-2">
								{#each featuredShares.slice(0, 4) as share}
									<button
										class="text-md button hover:bg-surface1 dark:hover:bg-surface3 flex w-full items-center gap-2 rounded-sm bg-transparent px-2 text-left font-light"
									>
										<img
											src={getProjectImage(share, darkMode.isDark)}
											class="size-5"
											alt={share.name}
										/>
										{share.name}
									</button>
								{/each}
								<a
									href="/"
									class="text-md button hover:bg-surface1 dark:hover:bg-surface3 flex w-full items-center gap-2 rounded-sm bg-transparent px-2 font-light"
								>
									See More Templates
								</a>
							</div>
						</div>
						<div class="border-surface2 dark:border-surface3 flex flex-col border-t p-2">
							<button
								class="text-md button hover:bg-surface1 dark:hover:bg-surface3 flex w-full items-center gap-2 rounded-sm bg-transparent px-2 font-light"
							>
								<Scroll class="size-4" /> Start From Scratch
							</button>
						</div>
					</dialog>
				</div>
			</div>

			<div class="dark:bg-surface2 w-full overflow-hidden rounded-md bg-white shadow-sm">
				<table class="w-full border-collapse">
					<thead class="dark:bg-surface1 bg-surface2">
						<tr>
							<th class="text-md w-1/2 px-4 py-2 text-left font-medium text-gray-500">Agent</th>
							{#if !responsive.isMobile}
								<th class="text-md w-1/4 px-4 py-2 text-left font-medium text-gray-500">Owner</th>
								<th class="text-md w-1/4 px-4 py-2 text-left font-medium text-gray-500">Created</th>
							{/if}
							<th class="text-md w-auto px-4 py-2 text-left font-medium text-gray-500">Actions</th>
						</tr>
					</thead>
					<tbody>
						{#each agents as project (project.id)}
							<tr class="border-surface2 dark:border-surface2 border-t shadow-xs">
								<td>
									<a href={`/o/${project.id}`}>
										<div class="flex h-full w-full items-center gap-2 px-4 py-2">
											<img
												src={getProjectImage(project, darkMode.isDark)}
												class="size-10 rounded-full shadow-md"
												alt={project.name}
											/>
											<div class="flex flex-col">
												<h4
													class="line-clamp-1 text-sm font-medium"
													class:text-gray-500={!project.name}
												>
													{project.name || 'Untitled'}
												</h4>
												<p
													class="line-clamp-1 text-xs font-light"
													class:text-gray-300={!project.description}
												>
													{project.description || 'No description'}
												</p>
											</div>
										</div>
									</a>
								</td>
								{#if !responsive.isMobile}
									<td class="text-sm font-light">
										<a class="flex h-full w-full px-4 py-2" href={`/o/${project.id}`}>Unspecified</a
										>
									</td>
									<td class="text-sm font-light">
										<a class="flex h-full w-full px-4 py-2" href={`/o/${project.id}`}
											>{formatTime(project.created)}</a
										>
									</td>
								{/if}
								<td class="flex justify-end px-4 py-2 text-sm font-light">
									<button class="icon-button" onclick={() => (toDelete = project)}>
										<Trash2 class="size-4" />
									</button>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	</main>
</div>

<Confirm
	msg={`Delete agent: ${toDelete?.name ?? 'Untitled'}?`}
	show={!!toDelete}
	onsuccess={async () => {
		if (!toDelete) return;
		try {
			await ChatService.deleteProject(toDelete.assistantID, toDelete.id);
			agents = agents.filter((p) => p.id !== toDelete?.id);
		} finally {
			toDelete = undefined;
		}
	}}
	oncancel={() => (toDelete = undefined)}
/>

<svelte:head>
	<title>Obot | Agents</title>
</svelte:head>
