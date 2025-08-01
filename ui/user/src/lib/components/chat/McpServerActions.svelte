<script lang="ts">
	import {
		ChatService,
		type McpServerResource,
		type Project,
		type ProjectMCP
	} from '$lib/services';
	import { HardDrive, LoaderCircle, Trash2, Wrench } from 'lucide-svelte';
	import DotDotDot from '../DotDotDot.svelte';
	import ProjectMcpResources from '../mcp/ProjectMcpResources.svelte';
	import { errors } from '$lib/stores';
	import {
		closeSidebarConfig,
		getLayout,
		openMCPServerTools
	} from '$lib/context/chatLayout.svelte';
	import Confirm from '../Confirm.svelte';
	import type { LaunchFormData } from '../mcp/CatalogConfigureForm.svelte';
	import CatalogConfigureForm from '../mcp/CatalogConfigureForm.svelte';
	import type { ProjectMcpItem } from '$lib/context/projectMcps.svelte';

	interface Props {
		mcpServer: ProjectMcpItem;
		project: Project;
		onDelete?: (mcp: ProjectMcpItem) => void;
		class?: string;
		actionsOnly?: boolean;
	}

	let { mcpServer, project, onDelete, class: klass, actionsOnly }: Props = $props();
	let resources = $state<Record<string, McpServerResource[]>>({});
	let mcpResourceToShow = $state<ProjectMCP>();
	let resourcesDialog = $state<ReturnType<typeof ProjectMcpResources>>();
	let toDelete = $state<ProjectMCP>();

	let configDialog = $state<ReturnType<typeof CatalogConfigureForm>>();
	let configForm = $state<LaunchFormData>();
	const layout = getLayout();

	async function loadResources(mcp: ProjectMcpItem) {
		if (!project?.assistantID || !project.id || !mcp.authenticated) return;

		try {
			const res = await ChatService.listProjectMcpServerResources(
				project.assistantID,
				project.id,
				mcp.id
			);
			resources[mcp.id] = res;
		} catch (error) {
			// 424 means resources not supported
			if (error instanceof Error && !error.message.includes('424')) {
				console.error('Failed to load resources for MCP server:', mcp.id, error);
				errors.append(error);
			}

			resources[mcp.id] = [];
		}
	}

	async function handleRemoveMcp() {
		if (!toDelete || !project?.assistantID || !project.id) return;

		closeSidebarConfig(layout);
		await ChatService.deleteProjectMCP(project.assistantID, project.id, toDelete.id);
		onDelete?.(toDelete);
		toDelete = undefined;
	}
</script>

{#if actionsOnly}
	{@render actions()}
{:else}
	<DotDotDot class={klass} onClick={() => loadResources(mcpServer)}>
		<div class="default-dialog flex min-w-max flex-col p-2">
			{@render actions()}
		</div>
	</DotDotDot>
{/if}

{#snippet actions()}
	<button
		class="menu-button"
		onclick={() => openMCPServerTools(layout, mcpServer)}
		disabled={!mcpServer.authenticated}
	>
		<Wrench class="size-4" /> View Tools
	</button>
	{#if resources[mcpServer.id]}
		{#if resources[mcpServer.id].length > 0}
			<button
				class="menu-button"
				onclick={() => {
					mcpResourceToShow = mcpServer;
					resourcesDialog?.open();
				}}
				disabled={!mcpServer.authenticated}
			>
				<HardDrive class="size-4" /> View Resources
			</button>
		{/if}
	{:else}
		<button disabled class="menu-button opacity-50 hover:bg-transparent">
			{#if !mcpServer.authenticated}
				<HardDrive class="size-4" /> View Resources
			{:else}
				<LoaderCircle class="size-4 animate-spin" /> View Resources
			{/if}
		</button>
	{/if}
	<button class="menu-button" onclick={() => (toDelete = mcpServer)}>
		<Trash2 class="size-4" /> Delete
	</button>
{/snippet}

<ProjectMcpResources
	bind:this={resourcesDialog}
	{project}
	mcp={mcpResourceToShow}
	resources={mcpResourceToShow ? (resources[mcpResourceToShow?.id] ?? []) : []}
/>

<Confirm
	msg="Are you sure you want to delete your MCP server configuration?"
	show={!!toDelete}
	onsuccess={handleRemoveMcp}
	oncancel={() => (toDelete = undefined)}
/>

<CatalogConfigureForm
	bind:this={configDialog}
	bind:form={configForm}
	onClose={() => (configForm = undefined)}
	onCancel={() => {
		configForm = undefined;
	}}
/>
