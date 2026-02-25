<script lang="ts">
	import Layout from '$lib/components/Layout.svelte';
	import ProjectSidebar from '../../ProjectSidebar.svelte';
	import { ChatService } from '$lib/services/nanobot/chat/index.svelte';
	import * as nanobotLayout from '$lib/context/nanobotLayout.svelte';
	import { page } from '$app/state';
	import { get } from 'svelte/store';
	import { nanobotChat } from '$lib/stores/nanobotChat.svelte';
	import FileEditor from '$lib/components/nanobot/FileEditor.svelte';
	import QuickAccess from '$lib/components/nanobot/QuickAccess.svelte';
	import { afterNavigate } from '$app/navigation';
	import { setContext } from 'svelte';
	import type { ChatMessageItemToolCall, ProjectLayoutContext } from '$lib/services/nanobot/types';
	import { PROJECT_LAYOUT_CONTEXT } from '$lib/services/nanobot/types';

	let { data, children } = $props();
	let projectId = $derived(data.projectId);
	let parentWorkflowId = $derived(
		(page.data as { workflowName?: string } | undefined)?.workflowName ??
			page.url.searchParams.get('pwid') ??
			undefined
	);
	let workflowId = $derived(page.url.searchParams.get('wid') ?? undefined);

	let threadId = $derived(page.url.searchParams.get('tid') ?? undefined);
	let selectedFile = $state('');
	let threadContentWidth = $state(0);
	let layoutName = $state('');
	let showBackButton = $state(false);

	const layout = nanobotLayout.getLayout();

	const threadWriteToolItems = $derived.by((): ChatMessageItemToolCall[] => {
		const items: ChatMessageItemToolCall[] = [];
		// eslint-disable-next-line svelte/prefer-svelte-reactivity
		const existing = new Set<string>();
		if (!threadId) return items;
		if ($nanobotChat?.chat?.messages?.length) {
			for (const message of $nanobotChat.chat.messages) {
				if (message.role !== 'assistant') continue;
				for (const item of message.items || []) {
					if (
						item.type === 'tool' &&
						(item.name === 'todoWrite' || item.name === 'write') &&
						item.arguments
					) {
						try {
							const args = JSON.parse(item.arguments);
							if (args.file_path && !existing.has(args.file_path)) {
								existing.add(args.file_path);
								items.push(item as ChatMessageItemToolCall);
							}
						} catch {
							console.error('Failed to parse tool call arguments', item);
						}
					}
				}
			}
		}
		if (workflowId) {
			items.push({
				type: 'tool',
				name: 'write',
				callID: `workflow-${workflowId}`,
				arguments: JSON.stringify({ file_path: `workflow:///${workflowId}` })
			} as ChatMessageItemToolCall);
		}
		return items;
	});

	function handleFileOpen(filename: string) {
		layout.quickBarAccessOpen = false;
		selectedFile = filename;
	}

	const projectLayoutContext = $state<ProjectLayoutContext>({
		chat: null as ChatService | null,
		threadWriteToolItems: [] as ChatMessageItemToolCall[],
		handleFileOpen,
		setThreadContentWidth: (w: number) => (threadContentWidth = w),
		setLayoutName: (name: string) => (layoutName = name),
		setShowBackButton: (show: boolean) => (showBackButton = show)
	});

	$effect(() => {
		projectLayoutContext.threadWriteToolItems = threadWriteToolItems;
		if (parentWorkflowId || workflowId) {
			const workflow = get(nanobotChat)?.workflows?.find((r) =>
				parentWorkflowId
					? r.uri === `workflow:///${parentWorkflowId}`
					: r.uri === `workflow:///${workflowId}`
			);
			const name = (workflow?._meta?.name as string) ?? workflow?.name ?? '';
			projectLayoutContext.setLayoutName(name);
			projectLayoutContext.setShowBackButton(true);
		} else {
			projectLayoutContext.setLayoutName('');
			projectLayoutContext.setShowBackButton(false);
		}
	});

	setContext(PROJECT_LAYOUT_CONTEXT, projectLayoutContext);

	afterNavigate(() => {
		if (workflowId) {
			selectedFile = `workflow:///${workflowId}`;
		} else {
			selectedFile = '';
		}

		if (!threadId) {
			layout.quickBarAccessOpen = false;
		}
	});
</script>

<Layout
	title={layoutName}
	layoutContext={nanobotLayout}
	classes={{
		container: 'px-0 py-0 md:px-0',
		childrenContainer: 'max-w-full h-[calc(100dvh-4rem)]',
		collapsedSidebarHeaderContent: 'pb-0',
		sidebar: 'pt-0 px-0',
		sidebarRoot: 'bg-base-200'
	}}
	{showBackButton}
	whiteBackground
	disableResize
	hideProfileButton
	alwaysShowHeaderTitle
>
	{#snippet leftSidebar()}
		<ProjectSidebar selectedThreadId={threadId} {projectId} />
	{/snippet}

	<div
		class="flex w-full min-w-0 grow"
		style={threadContentWidth > 0 ? `min-width: ${threadContentWidth}px` : ''}
	>
		{@render children?.()}
	</div>

	{#snippet rightSidebar()}
		{#if $nanobotChat?.chat}
			{#if selectedFile}
				<FileEditor
					filename={selectedFile}
					chat={$nanobotChat.chat}
					open={!!selectedFile}
					onClose={() => {
						selectedFile = '';
					}}
					quickBarAccessOpen={layout.quickBarAccessOpen}
					{threadContentWidth}
				/>
			{/if}

			<QuickAccess
				onToggle={() => (layout.quickBarAccessOpen = !layout.quickBarAccessOpen)}
				open={layout.quickBarAccessOpen}
				files={threadWriteToolItems}
				{threadId}
				{selectedFile}
			/>
		{/if}
	{/snippet}
</Layout>

<svelte:head>
	<title>Nanobot</title>
</svelte:head>
