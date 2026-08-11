<script lang="ts" generics="TProps extends Record<string, any>">
	import type { Component, Snippet } from 'svelte';

	interface Props {
		subject: Component<TProps>;
		subjectProps: TProps;
		icon: Snippet;
	}

	let { subject: Subject, subjectProps, icon: iconContent }: Props = $props();
</script>

<Subject {...subjectProps}>
	{#snippet icon()}
		{@render iconContent()}
	{/snippet}
</Subject>
