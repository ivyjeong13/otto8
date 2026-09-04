<script lang="ts">
	import VMcpDesigner from '$lib/components/vmcps/VMcpDesigner.svelte';
	import { mcpServersAndEntries } from '$lib/stores';

	let { data } = $props();
	let catalogEntry = $derived(
		mcpServersAndEntries.current.entries.find((entry) => entry.id === data.catalogEntry.id) ??
			data.catalogEntry
	);
</script>

<VMcpDesigner vmcp={catalogEntry} />
