<script lang="ts">
	import { ExternalLink, Server } from 'lucide-svelte';
	import ResponsiveDialog from '../ResponsiveDialog.svelte';
	import CopyButton from '../CopyButton.svelte';
	import HowToConnect from './HowToConnect.svelte';
	import {
		ChatService,
		EditorService,
		type MCPCatalogServer,
		type MCPServerInstance
	} from '$lib/services';
	import { createProjectMcp } from '$lib/services/chat/mcp';
	import { goto } from '$app/navigation';
	import PageLoading from '../PageLoading.svelte';

	type Props = {
		server?: MCPCatalogServer;
		instance?: MCPServerInstance;
	};

	let { server, instance }: Props = $props();
	let connectDialog = $state<ReturnType<typeof ResponsiveDialog>>();
	let chatLoading = $state(false);
	let chatLoadingProgress = $state(0);
	let chatLaunchError = $state<string>();

	let name = $derived(server?.alias || server?.manifest.name || '');

	export function open() {
		connectDialog?.open();
	}

	export async function handleSetupChat(
		connectedServer: MCPCatalogServer,
		instance?: MCPServerInstance
	) {
		connectDialog?.close();
		chatLaunchError = undefined;
		chatLoading = true;
		chatLoadingProgress = 0;

		let timeout1 = setTimeout(() => {
			chatLoadingProgress = 10;
		}, 1000);
		let timeout2 = setTimeout(() => {
			chatLoadingProgress = 50;
		}, 5000);
		let timeout3 = setTimeout(() => {
			chatLoadingProgress = 80;
		}, 10000);

		const projects = await ChatService.listProjects();
		const name = [
			connectedServer.alias || connectedServer.manifest.name || '',
			connectedServer.id
		].join(' - ');
		const match = projects.items.find((project) => project.name === name);

		let project = match;
		if (!match) {
			// if no project match, create a new one w/ mcp server connected to it
			project = await EditorService.createObot({
				name: name
			});
		}

		try {
			const mcpId = instance ? instance.id : connectedServer.id;
			if (
				project &&
				!(await ChatService.listProjectMCPs(project.assistantID, project.id)).find(
					(mcp) => mcp.mcpID === mcpId
				)
			) {
				await createProjectMcp(project, mcpId);
			}
		} catch (err) {
			chatLaunchError = err instanceof Error ? err.message : 'An unknown error occurred';
		} finally {
			clearTimeout(timeout1);
			clearTimeout(timeout2);
			clearTimeout(timeout3);
		}

		chatLoadingProgress = 100;
		setTimeout(() => {
			chatLoading = false;
			goto(`/o/${project?.id}`);
		}, 1000);
	}
</script>

<ResponsiveDialog bind:this={connectDialog} animate="slide">
	{#snippet titleContent()}
		{#if server}
			{@const icon = server.manifest.icon ?? ''}

			<div class="bg-surface1 rounded-sm p-1 dark:bg-gray-600">
				{#if icon}
					<img src={icon} alt={name} class="size-8" />
				{:else}
					<Server class="size-8" />
				{/if}
			</div>
			{name}
		{/if}
	{/snippet}

	{#if server}
		{@const url = server.connectURL}
		<div class="flex items-center gap-4">
			<div class="mb-4 flex grow flex-col gap-1">
				<label for="connectURL" class="font-light">Connection URL</label>
				<div class="mock-input-btn flex w-full items-center justify-between gap-2 shadow-inner">
					<p>
						{url}
					</p>
					<CopyButton
						showTextLeft
						text={url}
						classes={{
							button: 'flex-shrink-0 flex items-center gap-1 text-xs font-light hover:text-blue-500'
						}}
					/>
				</div>
			</div>
			<div class="w-32">
				<button
					class="button-primary flex h-fit w-full grow items-center justify-center gap-2 text-sm"
					onclick={() => handleSetupChat(server, instance)}
				>
					Chat <ExternalLink class="size-4" />
				</button>
			</div>
		</div>

		{#if url}
			<HowToConnect servers={[{ url, name }]} />
		{/if}
	{/if}
</ResponsiveDialog>

<PageLoading
	show={chatLoading}
	isProgressBar
	progress={chatLoadingProgress}
	text="Loading chat..."
	error={chatLaunchError}
	longLoadMessage="Connecting MCP Server to chat..."
	longLoadDuration={10000}
	onClose={() => {
		chatLoading = false;
	}}
/>
