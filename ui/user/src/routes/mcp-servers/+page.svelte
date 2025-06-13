<script lang="ts">
	import { tooltip } from '$lib/actions/tooltip.svelte';
	import Layout from '$lib/components/Layout.svelte';
	import Table from '$lib/components/Table.svelte';
	import { Plus, Trash2, Unplug } from 'lucide-svelte';
	import { fade } from 'svelte/transition';

	const mockMyServers: {
		id: number;
		name: string;
		type: 'hosted' | 'remote';
		lastConnected: string;
	}[] = [
		{
			id: 1,
			name: 'My Github Server',
			type: 'hosted',
			lastConnected: '2025-06-13T12:00:00Z'
		},
		{
			id: 2,
			name: 'My-Docs-1',
			type: 'remote',
			lastConnected: '2025-06-13T12:00:00Z'
		}
	];

	const mockAvailableServers: (typeof mockMyServers)[0][] = [
		{
			id: 3,
			name: 'Engineering Firecrawl',
			type: 'hosted',
			lastConnected: '2025-06-13T12:00:00Z'
		},
		{
			id: 4,
			name: 'My-Docs-2',
			type: 'remote',
			lastConnected: '2025-06-13T12:00:00Z'
		}
	];
</script>

<Layout>
	<div class="my-8 flex flex-col gap-8" in:fade>
		<div class="mb-2 flex items-center justify-between">
			<h1 class="text-2xl font-semibold">My MCP Servers</h1>
			<div class="relative flex items-center gap-4">
				<button class="button-primary flex items-center gap-1 text-sm" onclick={() => {}}>
					<Plus class="size-6" /> Add New Server
				</button>
			</div>
		</div>
		<Table data={mockMyServers} fields={['name', 'type', 'lastConnected']}>
			{#snippet actions(d)}
				<button
					class="icon-button hover:text-blue-500"
					onclick={() => {
						console.log(d);
					}}
					use:tooltip={'Connect'}
				>
					<Unplug class="size-4" />
				</button>
			{/snippet}
		</Table>

		<div class="mb-2 flex items-center justify-between">
			<h1 class="text-2xl font-semibold">Available MCP Servers</h1>
		</div>
		<Table data={mockAvailableServers} fields={['name', 'type', 'lastConnected']}>
			{#snippet actions(d)}
				<button
					class="icon-button hover:text-blue-500"
					onclick={() => {
						console.log(d);
					}}
					use:tooltip={'Connect'}
				>
					<Unplug class="size-4" />
				</button>
			{/snippet}
		</Table>
	</div>
</Layout>
