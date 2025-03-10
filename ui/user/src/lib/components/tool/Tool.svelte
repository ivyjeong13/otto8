<script lang="ts">
	import { autoHeight } from '$lib/actions/textarea.js';
	import { Container, X, ChevronDown, ChevronUp } from 'lucide-svelte';
	import { type AssistantTool, ChatService, EditorService } from '$lib/services';
	import { currentAssistant } from '$lib/stores';
	import Confirm from '$lib/components/Confirm.svelte';
	import Dropdown from '$lib/components/tasks/Dropdown.svelte';
	import Env from '$lib/components/tool/Env.svelte';
	import { masked } from '$lib/components/tool/Env.svelte';
	import Params from '$lib/components/tool/Params.svelte';
	import Codemirror from '$lib/components/editor/Codemirror.svelte';
	import Controls from '$lib/components/editor/Controls.svelte';
	import { Trash } from '$lib/icons';
	import type { EditorItem } from '$lib/stores/editor.svelte';

	interface Props {
		id: string;
	}

	let { id }: Props = $props();

	const blankTool: AssistantTool = {
		id,
		toolType: 'javascript'
	};

	const defaultParams = {
		msg: 'A message to be echoed'
	};
	const defaultInstructions: Record<string, string> = {
		javascript: `

// Arguments to the tool are available as env vars in CAPITAL_CASE form
// Output for the tool is just the content on stdout (or console.log)

console.log(\`Your message \${process.env.MSG}\`);
	`,
		python: `This is python`,
		script: `This is a script`,
		container: ''
	};

	let tool: AssistantTool = $state({ ...blankTool });
	let saved: AssistantTool = $state({ ...blankTool });
	let dirty = $derived.by(() => JSON.stringify(tool) !== JSON.stringify(saved));
	let params: { key: string; value: string }[] = $state([]);
	let input: { key: string; value: string }[] = $state([]);
	let envs: { key: string; value: string; editing: string }[] = $state([]);
	let requestDelete = $state(false);
	let loaded = load();
	let advanced = $state(false);
	let editorFile = $state<EditorItem>({
		id: '',
		name: '',
		contents: '',
		buffer: ''
	});
	let testOutput = $state<Promise<{ output: string }>>();
	let dialog: HTMLDialogElement;

	$effect(() => {
		const item = EditorService.items.find((item) => item.id === id);
		if (item) {
			item.name = tool.name ? tool.name : tool.id;
			item.contents = JSON.stringify(saved);
			item.buffer = JSON.stringify(tool);
		}
	});

	$effect(() => {
		for (let i = 0; i < params.length; i++) {
			if (input.length <= i) {
				input.push({ key: params[i].key, value: '' });
			} else if (input[i].key !== params[i].key) {
				input[i].key = params[i].key;
			}
		}
		if (input.length > params.length) {
			input.splice(params.length);
		}
	});

	async function deleteTool() {
		requestDelete = false;
		if (!id) {
			return;
		}
		await ChatService.deleteTool($currentAssistant.id, id);
		EditorService.remove(id);
	}

	function toMap(values: { key: string; value: string }[]): Record<string, string> {
		return Object.fromEntries(values.map(({ key, value }) => [key, value]));
	}

	export async function save() {
		const newEnv = toMap(envs);
		tool.params = toMap(params);
		if (id) {
			await ChatService.updateTool($currentAssistant.id, tool, { env: newEnv });
		}
		await load();
	}

	function test(checkModal: boolean) {
		if (checkModal && !testOutput && params.length > 0) {
			dialog.showModal();
			return;
		}
		testOutput = ChatService.testTool(
			$currentAssistant.id,
			tool,
			Object.fromEntries(input.map(({ key, value }) => [key, value])),
			{
				env: toMap(envs)
			}
		);
		if (!checkModal) {
			dialog.close();
		}
	}

	async function cancel() {
		await load();
	}

	function switchType(newType: string) {
		if (newType === tool.toolType) {
			return;
		}
		if (!tool.instructions || tool.instructions === defaultInstructions[tool.toolType ?? '']) {
			tool.instructions = defaultInstructions[newType];
			editorFile.contents = tool.instructions;
		}
		tool.toolType = newType;
	}

	async function load() {
		if (!id || typeof window === 'undefined') {
			return;
		}
		tool = await ChatService.getTool($currentAssistant.id, id);

		if (!tool.toolType) {
			tool.toolType = 'javascript';
			tool.instructions = defaultInstructions['javascript'];
			if (Object.keys(tool.params ?? {}).length === 0) {
				tool.params = defaultParams;
			}
		}

		saved = { ...tool };
		const newEnvs = await ChatService.getToolEnv($currentAssistant.id, id);
		envs = Object.entries(newEnvs).map(([key, value]) => ({ key, value, editing: masked }));
		params = Object.entries(tool.params ?? {}).map(([key, value]) => ({ key, value }));

		editorFile.id = tool.id;
		editorFile.name = tool.name ?? tool.id;
		editorFile.contents = tool.instructions ?? '';
	}
</script>

<div class="relative flex flex-col gap-5 rounded-s-3xl p-5">
	<div class="absolute right-0 top-0 m-2 flex">
		<button class="icon-button" onclick={() => (requestDelete = true)}>
			<Trash class="h-5 w-5" />
		</button>
		<Controls />
	</div>

	{#await loaded then}
		<div class="flex flex-col">
			<input
				bind:value={tool.name}
				placeholder="Enter Name"
				class="text-xl font-semibold outline-none dark:bg-black"
			/>
			<input
				bind:value={tool.description}
				placeholder="Enter description (a good one is very helpful)"
				class="outline-none dark:bg-black"
			/>
		</div>

		<Params bind:params />

		<div class="flex flex-col gap-4 rounded-3xl bg-gray-50 p-5 dark:bg-gray-950">
			<div class="flex items-center">
				<span class="flex-1 text-lg font-semibold">
					{#if tool.toolType === 'container'}
						Image
					{:else if tool.toolType === 'script'}
						Script
					{:else}
						Code
					{/if}
				</span>
				<Dropdown
					values={{
						javascript: 'JavaScript',
						python: 'Python',
						script: 'Shell Script',
						container: 'Docker Image'
					}}
					selected={tool.toolType}
					class="p-0 hover:bg-gray-50 hover:dark:bg-gray-950"
					onSelected={switchType}
				/>
			</div>
			<div class="flex w-full gap-2">
				{#if tool.toolType === 'container'}
					<Container class="h-5 w-5" />
					<input
						bind:value={tool.image}
						class="bg-gray-50 outline-none dark:bg-gray-950"
						placeholder="Container image name"
					/>
				{:else}
					<Codemirror
						class="w-full"
						file={editorFile}
						onFileChanged={(_, c) => {
							tool.instructions = c;
						}}
					/>
				{/if}
			</div>
			<button
				onclick={() => {
					test(true);
				}}
				class="mt-3 self-end rounded-3xl bg-blue p-3 px-6 text-white"
			>
				Test</button
			>
		</div>

		{#if testOutput}
			<div class="relative flex flex-col gap-4 rounded-3xl bg-gray-50 p-5 dark:bg-gray-950">
				<div class="absolute right-0 top-0 flex p-5">
					<button onclick={() => (testOutput = undefined)}>
						<X class="h-5 w-5" />
					</button>
				</div>
				<h4 class="text-xl font-semibold">Output</h4>
				<Params bind:params={input} input />
				<div class="whitespace-pre-wrap font-mono text-sm">
					{#await testOutput}
						Running...
					{:then output}
						<div class="whitespace-pre-wrap rounded-3xl bg-white p-5 font-mono dark:bg-black">
							{output.output}
						</div>
					{:catch error}
						{error}
					{/await}
				</div>
			</div>
		{/if}

		<button
			class="flex items-center gap-2 self-end dark:text-gray"
			onclick={() => (advanced = !advanced)}
		>
			<span>Advanced Options</span>
			{#if advanced}
				<ChevronUp class="h-5 w-5" />
			{:else}
				<ChevronDown class="h-5 w-5" />
			{/if}
		</button>

		<div class:contents={advanced} class:hidden={!advanced}>
			<Env bind:envs />

			<div class="flex flex-col gap-2 rounded-3xl bg-gray-50 p-5 dark:bg-gray-950">
				<h4 class="text-xl font-semibold">Calling Instructions</h4>
				<textarea
					onchange={() => console.log('changed')}
					onfocus={() => console.log('changed')}
					bind:value={tool.context}
					use:autoHeight
					rows="1"
					class="resize-none bg-gray-50 outline-none dark:bg-gray-950"
					placeholder="(optional) More information on how or when AI should invoke this tool."
				></textarea>
			</div>

			<div class="flex flex-col gap-4 rounded-3xl bg-gray-50 p-5 dark:bg-gray-950">
				<h4 class="text-xl font-semibold">Runtime Docker Image</h4>
				<div class="flex gap-2">
					<Container class="h-5 w-5" />
					<input
						bind:value={tool.image}
						class="bg-gray-50 outline-none dark:bg-gray-950"
						placeholder="Container image name"
					/>
				</div>
			</div>
		</div>

		{#if dirty}
			<div class="flex justify-end gap-2">
				<button onclick={cancel} class="mt-3 rounded-3xl bg-gray-50 p-3 px-6 dark:bg-gray-950">
					Cancel
				</button>
				<button
					onclick={() => save()}
					class="mt-3 gap-2 rounded-3xl bg-blue p-3 px-6 text-white hover:bg-blue-400 hover:text-white"
				>
					{#if id}
						Save
					{:else}
						Create
					{/if}
				</button>
			</div>
		{/if}
	{/await}
</div>

<dialog
	bind:this={dialog}
	class="w-11/12 max-w-[1000px] rounded-3xl dark:bg-gray-950 dark:text-gray-50"
>
	<div class="relative flex flex-col p-5">
		<div class="absolute right-0 top-0 flex p-5">
			<button
				onclick={() => {
					dialog.close();
				}}
			>
				<X class="h-5 w-5" />
			</button>
		</div>
		<h4 class="mb-2 text-xl font-semibold">Input</h4>
		<Params bind:params={input} autofocus input />
		<button
			onclick={() => test(false)}
			class="mt-3 self-end rounded-3xl bg-blue p-3 px-6 text-white"
		>
			Run</button
		>
	</div>
</dialog>

<Confirm
	msg="Are you sure you want to delete this tool?"
	show={requestDelete}
	oncancel={() => (requestDelete = false)}
	onsuccess={() => deleteTool()}
/>

<style lang="postcss">
	dialog::backdrop {
		@apply bg-black bg-opacity-60;
	}
</style>
