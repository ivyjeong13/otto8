<script lang="ts">
	import { closeSidebarConfig } from '$lib/context/layout.svelte';
	import { getLayout } from '$lib/context/layout.svelte';
	import type { Project } from '$lib/services';
	import { ChevronsLeft, X } from 'lucide-svelte';
	import Confirm from '../Confirm.svelte';
	import { tooltip } from '$lib/actions/tooltip.svelte';
	import Search from '../Search.svelte';
	import SearchDropdown from '../SearchDropdown.svelte';

	interface Props {
		project: Project;
	}

	const layout = getLayout();
	let { project }: Props = $props();
	let toDelete = $state('');

	let search = $state('');
	let searchPopover = $state<HTMLDialogElement | null>(null);

	const mockMembers = [
		{
			id: '1',
			name: 'johndoe@gmail.com',
			email: 'johndoe@gmail.com',
			iconURL:
				'https://fastly.picsum.photos/id/453/200/200.jpg?hmac=IO3u3eOcKSOUCe8J1IlvctdxPKLTh5wFXvBT4O3BNs4'
		},
		{
			id: '2',
			name: 'janedoe@gmail.com',
			email: 'janedoe@gmail.com',
			iconURL:
				'https://fastly.picsum.photos/id/348/200/200.jpg?hmac=3DFdqMmDkl3bpk6cV1tumcDAzASPQUSbXHXWZIbIvks'
		}
	];
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
		class="dark:from-surface1 to-surface1 flex grow flex-col gap-4 bg-radial-[at_25%_25%] from-white to-75% p-8 shadow-inner dark:to-black"
	>
		<div class="text-md flex flex-col gap-8">
			<div class="flex flex-col gap-2">
				<h3 class="text-xl font-semibold">Members</h3>
				<p class="text-md font-light text-gray-500">
					Modify who has access to collaborate on your agent.
				</p>
			</div>

			<SearchDropdown
				items={mockMembers}
				onSearch={() => {}}
				selected={[]}
				placeholder="Search members..."
			/>

			<div class="flex flex-col gap-4">
				{#each mockMembers as member}
					<div class="group flex w-full items-center rounded-md transition-colors duration-300">
						<button class="flex grow items-center gap-2 pl-1.5" onclick={() => {}}>
							<div class="size-10 overflow-hidden rounded-full bg-gray-50 dark:bg-gray-600">
								<img
									src={member.iconURL}
									class="h-full w-full object-cover"
									alt="agent member icon"
								/>
							</div>
							<p class="text-md truncate text-left font-light">
								{member.email}
							</p>
						</button>
						<button
							class="icon-button"
							onclick={() => (toDelete = member.email)}
							use:tooltip={'Remove member'}
						>
							<X class="size-6" />
						</button>
					</div>
				{/each}
			</div>
		</div>
	</div>
</div>

<Confirm
	msg={`Remove ${toDelete} from your agent?`}
	show={!!toDelete}
	onsuccess={async () => {
		if (!toDelete) return;
		try {
			// TODO: remove member from project
		} finally {
			toDelete = '';
		}
	}}
	oncancel={() => (toDelete = '')}
/>
