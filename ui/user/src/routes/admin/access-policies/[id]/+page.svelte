<script lang="ts">
	import Layout from '$lib/components/Layout.svelte';
	import AccessPolicyForm from '$lib/components/admin/AccessPolicyForm.svelte';
	import { profile } from '$lib/stores';

	let { data } = $props();
</script>

<Layout title="Access Policy" showBackButton>
	<AccessPolicyForm
		accessPolicy={data.accessPolicy}
		readonly={profile.current.isAdminReadonly?.()}
	/>
</Layout>

<svelte:head><title>Obot | {data.accessPolicy.displayName}</title></svelte:head>
