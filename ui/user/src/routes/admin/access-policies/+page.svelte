<script lang="ts">
	import { page } from '$app/state';
	import Confirm from '$lib/components/Confirm.svelte';
	import Layout from '$lib/components/Layout.svelte';
	import AccessPolicyForm from '$lib/components/admin/AccessPolicyForm.svelte';
	import IconButton from '$lib/components/primitives/IconButton.svelte';
	import Table from '$lib/components/table/Table.svelte';
	import { AdminService, UserService, type AccessPolicy } from '$lib/services';
	import { profile } from '$lib/stores';
	import { clearUrlParams, goto } from '$lib/url';
	import { openUrl } from '$lib/utils';
	import { Plus, ShieldCheck, Trash2 } from '@lucide/svelte';
	import { untrack } from 'svelte';

	let { data } = $props();
	let policies = $state<AccessPolicy[]>(untrack(() => data.accessPolicies));
	let deleting = $state<AccessPolicy>();
	let creating = $derived(page.url.searchParams.has('new'));
	let readonly = $derived(profile.current.isAdminReadonly?.());

	function resourceKinds(policy: AccessPolicy) {
		return [
			(policy.mcpServers?.length ?? 0) > 0 && 'MCP',
			(policy.skills?.length ?? 0) > 0 && 'Skills',
			(policy.models?.length ?? 0) > 0 && 'Models',
			(policy.hostedAgents?.length ?? 0) > 0 && 'Hosted agents'
		]
			.filter(Boolean)
			.join(', ');
	}

	function policyURL(policy: AccessPolicy) {
		return policy.powerUserWorkspaceID
			? `/admin/access-policies/w/${policy.powerUserWorkspaceID}/${policy.id}`
			: `/admin/access-policies/${policy.id}`;
	}
</script>

<Layout title={creating ? 'Create Access Policy' : 'Access Policies'} showBackButton={creating}>
	{#if creating}
		<AccessPolicyForm
			{readonly}
			onCreate={(policy) => {
				clearUrlParams(['new']);
				goto(`/admin/access-policies/${policy.id}`);
			}}
		/>
	{:else if policies.length === 0}
		<div class="mt-16 flex flex-col items-center gap-4 text-center">
			<ShieldCheck class="text-muted-content size-20 opacity-30" />
			<div>
				<h2 class="text-lg font-semibold">No access policies</h2>
				<p class="text-muted-content text-sm">
					Create one policy to grant access across any resource type.
				</p>
			</div>
			{#if !readonly}<button
					class="btn btn-primary"
					onclick={() => goto('/admin/access-policies?new=true')}
					><Plus class="size-4" /> Add policy</button
				>{/if}
		</div>
	{:else}
		<Table
			data={policies.map((policy) => ({
				...policy,
				resourceKinds: resourceKinds(policy),
				scope: policy.powerUserID ? `Workspace: ${policy.powerUserID}` : 'Global',
				subjectCount: policy.subjects?.length ?? 0
			}))}
			fields={['displayName', 'scope', 'resourceKinds', 'subjectCount']}
			headers={[
				{ property: 'displayName', title: 'Name' },
				{ property: 'scope', title: 'Scope' },
				{ property: 'resourceKinds', title: 'Resources' },
				{ property: 'subjectCount', title: 'Subjects' }
			]}
			sortable={['displayName']}
			onClickRow={(policy, ctrl) => openUrl(policyURL(policy), ctrl)}
		>
			{#snippet actions(policy)}{#if !readonly && !policy.generated}<IconButton
						variant="danger"
						tooltip={{ text: 'Delete policy' }}
						onclick={(event) => {
							event.stopPropagation();
							deleting = policy;
						}}><Trash2 class="size-4" /></IconButton
					>{/if}{/snippet}
			{#snippet onRenderColumn(property, policy)}{policy[property as keyof typeof policy]}{/snippet}
		</Table>
	{/if}

	{#snippet rightNavActions()}{#if !creating && !readonly}<button
				class="btn btn-primary btn-sm"
				onclick={() => goto('/admin/access-policies?new=true')}
				><Plus class="size-4" /> Add policy</button
			>{/if}{/snippet}
</Layout>

<Confirm
	msg={`Delete ${deleting?.displayName || 'this policy'}?`}
	show={Boolean(deleting)}
	onsuccess={async () => {
		if (!deleting) return;
		if (deleting.powerUserWorkspaceID)
			await UserService.deleteWorkspaceAccessPolicy(deleting.powerUserWorkspaceID, deleting.id);
		else await AdminService.deleteAccessPolicy(deleting.id);
		const [globalPolicies, workspacePolicies] = await Promise.all([
			AdminService.listAccessPolicies(),
			AdminService.listAllWorkspaceAccessPolicies()
		]);
		policies = [...globalPolicies, ...workspacePolicies];
		deleting = undefined;
	}}
	oncancel={() => (deleting = undefined)}
/>

<svelte:head><title>Obot | Access Policies</title></svelte:head>
