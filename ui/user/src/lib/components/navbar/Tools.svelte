<script lang="ts">
	import { Plus, Wrench } from '$lib/icons';
	import { tools, version } from '$lib/stores';
	import { currentAssistant } from '$lib/stores';
	import { ChatService, EditorService } from '$lib/services';
	import Menu from '$lib/components/navbar/Menu.svelte';
	import { PenBox } from 'lucide-svelte';

	let menu = $state<ReturnType<typeof Menu>>();

	async function addTool() {
		const tool = await ChatService.createTool($currentAssistant.id, {
			id: '',
			params: {
				msg: 'A message to be echoed'
			},
			toolType: 'javascript',
			instructions: `

// Arguments to the tool are available as env vars in CAPITAL_CASE form
// Output for the tool is just the content on stdout (or console.log)

console.log(\`Your message \${process.env.MSG}\`);

`
		});
		await EditorService.load($currentAssistant.id, tool.id);
		menu?.open.set(false);
	}

	async function editTool(id: string) {
		await EditorService.load($currentAssistant.id, id);
		menu?.open.set(false);
	}

	async function onLoad() {
		tools.set(await ChatService.listTools($currentAssistant.id));
	}

	async function updateTool(enabled: boolean, tool: string | undefined) {
		if (!tool) {
			return;
		}
		if (enabled) {
			tools.set(await ChatService.enableTool($currentAssistant.id, tool));
		} else {
			tools.set(await ChatService.disableTool($currentAssistant.id, tool));
		}
	}
</script>

<Menu bind:this={menu} title="Tools" description="Enable or disable available tools" {onLoad}>
	{#snippet icon()}
		<Wrench class="h-5 w-5" />
	{/snippet}
	{#snippet body()}
		<ul class="space-y-4 py-6 text-sm">
			{#each $tools.items as tool, i}
				{#if !tool.builtin}
					<li>
						<div class="flex">
							{#if tool.icon}
								<img
									class="h-8 w-8 rounded-md bg-gray-100 p-1"
									src={tool.icon}
									alt="message icon"
								/>
							{:else}
								<Wrench class="h-8 w-8 rounded-md bg-gray-100 p-1 text-black" />
							{/if}
							<div class="flex flex-1 px-2">
								<div>
									<label for="checkbox-item-{i}" class="text-sm font-medium dark:text-gray-100"
										>{tool.name}</label
									>
									<p class="text-xs font-normal text-gray dark:text-gray-300">
										{tool.description}
									</p>
								</div>
							</div>
							<input
								id="checkbox-item-{i}"
								type="checkbox"
								checked={tool.enabled}
								onchange={(e) => updateTool(e.currentTarget.checked, tool.id)}
								disabled={tool.builtin || $tools.readonly}
								class="h-4 w-4 self-center"
							/>
							<button
								class="p-1"
								class:invisible={!tool.id.startsWith('tl1')}
								onclick={() => editTool(tool.id)}
							>
								<PenBox class="h-4 w-4" />
							</button>
						</div>
					</li>
				{/if}
			{/each}
		</ul>
		{#if version.current.dockerSupported}
			<div class="flex justify-end">
				<button
					onclick={addTool}
					class="-mb-3 -mr-3 mt-3 flex items-center justify-end gap-2 rounded-3xl p-3 px-4 hover:bg-gray-500 hover:text-white"
				>
					Add Custom Tool
					<Plus class="ms-1 h-5 w-5" />
				</button>
			</div>
		{/if}
	{/snippet}
</Menu>
