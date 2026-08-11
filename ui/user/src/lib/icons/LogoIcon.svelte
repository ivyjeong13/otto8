<script lang="ts">
	import { appPreferences } from '$lib/stores';
	import { twMerge } from 'tailwind-merge';

	interface Props {
		class?: string;
	}

	let { class: klass }: Props = $props();

	let logoSrc = $derived(appPreferences.current.logos?.logoIcon);
</script>

<div
	class={twMerge('size-5', klass)}
	role="img"
	aria-label="Obot logo icon"
	style="background-color: currentColor; mask: url({logoSrc}) center / contain no-repeat; -webkit-mask: url({logoSrc}) center / contain no-repeat;"
></div>
