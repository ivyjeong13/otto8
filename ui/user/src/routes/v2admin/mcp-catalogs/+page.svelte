<script lang="ts">
	import { tooltip } from '$lib/actions/tooltip.svelte';
	import Layout from '$lib/components/Layout.svelte';
	import ProjectMcpConfig from '$lib/components/mcp/ProjectMcpConfig.svelte';
	import Search from '$lib/components/Search.svelte';
	import Table from '$lib/components/Table.svelte';
	import type { MCPServer, ProjectMCP } from '$lib/services/chat/types';
	import { ChevronLeft, Plus, Trash2 } from 'lucide-svelte';
	import { fade } from 'svelte/transition';

	type AdminMCPServer = Omit<MCPServer, 'description' | 'icon' | 'name' | 'id'> & {
		description?: string;
		icon?: string;
		name?: string;
		id?: string;
	};

	const mockData: { id: number; name: string; entries: number }[] = [
		{
			id: 1,
			name: 'Common',
			entries: 100
		},
		{
			id: 2,
			name: 'Engineering',
			entries: 32
		},
		{
			id: 3,
			name: 'Marketing',
			entries: 15
		}
	];

	const mockSources: { id: number; name: string; updated: string }[] = [
		{
			id: 1,
			name: 'github.acme-corp.com/it/obot-catalog',
			updated: new Date().toISOString()
		},
		{
			id: 2,
			name: 'github.acme-corp.com/it/test-catalog',
			updated: new Date().toISOString()
		}
	];

	const mockEntries: {
		id: number;
		source?: (typeof mockSources)[0];
		name: string;
		type?: 'hosted' | 'remote';
		deployments: number;
		manifest: AdminMCPServer;
	}[] = [
		{
			id: 1,
			name: 'Tavily',
			source: mockSources[0],
			type: 'hosted',
			deployments: 100,
			manifest: {
				env: [
					{
						key: 'TAVILY_API_KEY',
						description: 'Your Tavily APY key. Get one at https:/app.tavily.com/home',
						file: false,
						name: 'Tavily APY Key',
						required: true,
						sensitive: true
					}
				],
				command: 'npx',
				args: ['-y', 'tavily-mcp@latest']
			}
		},
		{
			id: 2,
			name: 'PayPal',
			source: mockSources[1],
			type: 'remote',
			deployments: 32,
			manifest: {
				url: 'https://mcp.paypal.com/sse'
			}
		},
		{
			id: 3,
			name: 'Pinecone',
			manifest: {
				url: 'https://pinecone.acme-corp.com/mcp/assistants/**'
			},
			deployments: 15
		}
	];

	const mockUserGroups: {
		id: number;
		name: string;
		type: 'user' | 'group';
		role: 'owner' | 'user';
	}[] = [
		{
			id: 1,
			name: 'Craig Jellick',
			type: 'user',
			role: 'owner'
		},
		{
			id: 2,
			name: 'Engineering',
			type: 'group',
			role: 'user'
		}
	];

	let selectedConfig = $state<(typeof mockData)[0]>();
	let selectedEntry = $state<(typeof mockEntries)[0]>();
	let search = $state('');
</script>

<Layout>
	{#if selectedEntry}
		{@render configureEntryScreen(selectedEntry)}
	{:else if selectedConfig}
		{@render configureCatalogScreen(selectedConfig)}
	{:else}
		<div class="my-8 flex flex-col gap-8" in:fade>
			<div class="flex items-center justify-between">
				<h1 class="text-2xl font-semibold">MCP Catalogs</h1>
				<div class="relative flex items-center gap-4">
					<button class="button-primary flex items-center gap-1 text-sm" onclick={() => {}}>
						<Plus class="size-6" /> Create New Catalog
					</button>
				</div>
			</div>
			<Table data={mockData} fields={['name', 'entries']} onSelectRow={(d) => (selectedConfig = d)}>
				{#snippet actions(d)}
					<button
						class="icon-button"
						onclick={() => {
							console.log(d);
						}}
						use:tooltip={'Delete catalog'}
					>
						<Trash2 class="size-4" />
					</button>
				{/snippet}
			</Table>
		</div>
	{/if}
</Layout>

{#snippet configureCatalogScreen(config: { id: number; name: string; entries: number })}
	<div class="flex flex-col gap-8 py-8" in:fade>
		<button
			onclick={() => (selectedConfig = undefined)}
			class="button-text flex -translate-x-1 items-center gap-2 p-0 text-lg font-light"
		>
			<ChevronLeft class="size-6" />
			Back to MCP Catalogs
		</button>

		<h1 class="text-2xl font-semibold">
			{config.name}
		</h1>

		<div class="flex flex-col gap-2">
			<div class="mb-2 flex items-center justify-between">
				<h2 class="text-lg font-semibold">Catalog Sources</h2>
				<div class="relative flex items-center gap-4">
					<button class="button-primary flex items-center gap-1 text-sm" onclick={() => {}}>
						<Plus class="size-4" /> Add Source
					</button>
				</div>
			</div>

			<Table data={mockSources} fields={['name', 'updated']}>
				{#snippet actions(d)}
					<button
						class="icon-button"
						onclick={() => {
							console.log(d);
						}}
					>
						<Trash2 class="size-4" />
					</button>
				{/snippet}
			</Table>
		</div>

		<div class="flex flex-col gap-2">
			<div class="mb-2 flex items-center justify-between">
				<h2 class="text-lg font-semibold">Catalog Entries</h2>

				<div class="relative flex items-center gap-4">
					<button class="button-primary flex items-center gap-1 text-sm" onclick={() => {}}>
						<Plus class="size-4" /> Add Entry
					</button>
				</div>
			</div>

			<Search
				class="dark:bg-surface1 dark:border-surface3 bg-white shadow-sm dark:border"
				onChange={(val) => {
					search = val;
				}}
				placeholder="Search by name..."
			/>

			<Table
				data={mockEntries}
				fields={['name', 'type', 'deployments']}
				onSelectRow={(d) => (selectedEntry = d)}
			>
				{#snippet actions(d)}
					<button
						class="icon-button"
						onclick={() => {
							console.log(d);
						}}
					>
						<Trash2 class="size-4" />
					</button>
				{/snippet}
			</Table>
		</div>

		<div class="flex flex-col gap-2">
			<div class="mb-2 flex items-center justify-between">
				<h2 class="text-lg font-semibold">Users & Groups</h2>
				<div class="relative flex items-center gap-4">
					<button class="button-primary flex items-center gap-1 text-sm" onclick={() => {}}>
						<Plus class="size-4" /> Add User/Group
					</button>
				</div>
			</div>
			<Table data={mockUserGroups} fields={['name', 'type', 'role']}>
				{#snippet actions(d)}
					<button
						class="icon-button"
						onclick={() => {
							console.log(d);
						}}
					>
						<Trash2 class="size-4" />
					</button>
				{/snippet}
			</Table>
		</div>
	</div>
{/snippet}

{#snippet configureEntryScreen(entry: (typeof mockEntries)[0])}
	<div class="flex flex-col gap-6 py-8" in:fade>
		<button
			onclick={() => (selectedEntry = undefined)}
			class="button-text flex -translate-x-1 items-center gap-2 p-0 text-lg font-light"
		>
			<ChevronLeft class="size-6" />
			Back to {selectedConfig?.name ?? 'Source'}
		</button>

		<ProjectMcpConfig
			projectMcp={entry.manifest as unknown as ProjectMCP}
			onCreate={async (newProjectMcp) => {
				// projectMCPs.items.push(newProjectMcp);
				// closeSidebarConfig(layout);
			}}
			onUpdate={async (customMcpConfig) => {
				// if (!layout.editProjectMcp) return;
				// if (layout.chatbotMcpEdit) {
				// 	const keyValuePairs = getKeyValuePairs(customMcpConfig);
				// 	await ChatService.configureProjectMCPEnvHeaders(
				// 		project.assistantID,
				// 		project.id,
				// 		layout.editProjectMcp.id,
				// 		keyValuePairs
				// 	);
				// 	projectMCPs.items = projectMCPs.items.map((mcp) => {
				// 		if (mcp.id !== layout.editProjectMcp!.id) return mcp;
				// 		return {
				// 			...mcp,
				// 			env: customMcpConfig.env,
				// 			headers: customMcpConfig.headers
				// 		};
				// 	});
				// } else {
				// 	const updatedProjectMcp = await updateProjectMcp(
				// 		customMcpConfig,
				// 		layout.editProjectMcp.id,
				// 		project
				// 	);
				// 	projectMCPs.items = projectMCPs.items.map((mcp) =>
				// 		mcp.id === layout.editProjectMcp!.id ? updatedProjectMcp : mcp
				// 	);
				// }
				// closeSidebarConfig(layout);
			}}
		/>
	</div>
{/snippet}

<dialog>Add Source Dialog</dialog>

<dialog>Add User/Group Dialog</dialog>
