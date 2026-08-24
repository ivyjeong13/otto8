<script lang="ts">
	import { DEFAULT_MCP_CATALOG_ID } from '$lib/constants';
	import {
		AdminService,
		ModelUsage,
		UserService,
		type AccessControlRuleResource,
		type AccessControlRuleSubject,
		type AccessPolicy,
		type AccessPolicyManifest,
		type HostedAgent,
		type HostedAgentAccessPolicyResource,
		type Model,
		type ModelResource,
		type OrgGroup,
		type OrgUser,
		type SkillAccessPolicyResource,
		type SkillRepository
	} from '$lib/services';
	import type { Skill } from '$lib/services/nanobot/types';
	import { defaultModelAliases, errors, mcpServersAndEntries } from '$lib/stores';
	import { goto } from '$lib/url';
	import Loading from '../../icons/Loading.svelte';
	import Confirm from '../Confirm.svelte';
	import IconButton from '../primitives/IconButton.svelte';
	import SearchHostedAgents from './SearchHostedAgents.svelte';
	import SearchMcpServers from './SearchMcpServers.svelte';
	import SearchModels from './SearchModels.svelte';
	import SearchSkills from './SearchSkills.svelte';
	import SearchUsers from './SearchUsers.svelte';
	import { Plus, Trash2 } from '@lucide/svelte';
	import { onMount, untrack } from 'svelte';

	type EditableAccessPolicy = AccessPolicyManifest & {
		generated?: boolean;
		id?: string;
	};

	interface Props {
		accessPolicy?: AccessPolicy;
		onCreate?: (policy: AccessPolicy) => void;
		onUpdate?: (policy: AccessPolicy) => void;
		readonly?: boolean;
		workspaceID?: string;
	}

	let {
		accessPolicy: initialAccessPolicy,
		onCreate,
		onUpdate,
		readonly,
		workspaceID
	}: Props = $props();
	let policy = $state<EditableAccessPolicy>(
		untrack(() =>
			initialAccessPolicy
				? {
						...initialAccessPolicy,
						hostedAgents: [...(initialAccessPolicy.hostedAgents ?? [])],
						mcpServers: [...(initialAccessPolicy.mcpServers ?? [])],
						models: [...(initialAccessPolicy.models ?? [])],
						skills: [...(initialAccessPolicy.skills ?? [])],
						subjects: [...(initialAccessPolicy.subjects ?? [])]
					}
				: {
						displayName: '',
						hostedAgents: [],
						mcpServers: [],
						models: [],
						skills: [],
						subjects: []
					}
		)
	);

	let saving = $state(false);
	let deleting = $state(false);
	let loadingResources = $state(true);
	let models = $state<Model[]>([]);
	let skills = $state<Skill[]>([]);
	let skillRepositories = $state<SkillRepository[]>([]);
	let hostedAgents = $state<HostedAgent[]>([]);

	let searchUsers = $state<ReturnType<typeof SearchUsers>>();
	let searchMCPServers = $state<ReturnType<typeof SearchMcpServers>>();
	let searchSkills = $state<ReturnType<typeof SearchSkills>>();
	let searchModels = $state<ReturnType<typeof SearchModels>>();
	let searchHostedAgents = $state<ReturnType<typeof SearchHostedAgents>>();

	let locked = $derived(Boolean(readonly || policy.generated));
	let resourceCount = $derived(
		(policy.mcpServers?.length ?? 0) +
			(policy.skills?.length ?? 0) +
			(policy.models?.length ?? 0) +
			(policy.hostedAgents?.length ?? 0)
	);
	let valid = $derived(
		policy.displayName.trim().length > 0 && (policy.subjects?.length ?? 0) > 0 && resourceCount > 0
	);

	onMount(async () => {
		mcpServersAndEntries.initialize();
		try {
			const [allModels, allSkills, repositories, agents] = await Promise.all([
				AdminService.listModels({ all: true }),
				AdminService.listAllSkills(),
				AdminService.listSkillRepositories(),
				AdminService.listHostedAgents()
			]);
			models = allModels.filter((model) => model.usage === ModelUsage.LLM);
			skills = allSkills;
			skillRepositories = repositories;
			hostedAgents = agents;
		} catch (error) {
			errors.append(`Failed to load access policy resources: ${error}`);
		} finally {
			loadingResources = false;
		}
	});

	function addSubjects(users: OrgUser[], groups: OrgGroup[]) {
		const added: AccessControlRuleSubject[] = [
			...users.map((user) => ({ type: 'user' as const, id: user.id })),
			...groups.map((group) => ({
				type: group.id === '*' ? ('selector' as const) : ('group' as const),
				id: group.id
			}))
		];
		if (added.some((subject) => subject.type === 'selector' && subject.id === '*')) {
			policy.subjects = [{ type: 'selector', id: '*' }];
			return;
		}
		const existing = new Set((policy.subjects ?? []).map((subject) => subject.id));
		policy.subjects = [
			...(policy.subjects ?? []).filter((subject) => subject.id !== '*'),
			...added.filter((subject) => !existing.has(subject.id))
		];
	}

	function addMCPServers(entryIDs: string[], serverIDs: string[], selectors: string[]) {
		if (selectors.includes('*')) {
			policy.mcpServers = [{ type: 'selector', id: '*' }];
			return;
		}
		const existing = new Set((policy.mcpServers ?? []).map((resource) => resource.id));
		policy.mcpServers = [
			...(policy.mcpServers ?? []).filter((resource) => resource.id !== '*'),
			...entryIDs
				.filter((id) => !existing.has(id))
				.map((id) => ({ type: 'mcpServerCatalogEntry' as const, id })),
			...serverIDs
				.filter((id) => !existing.has(id))
				.map((id) => ({ type: 'mcpServer' as const, id }))
		];
	}

	function addSkills(resources: SkillAccessPolicyResource[]) {
		if (resources.some((resource) => resource.type === 'selector' && resource.id === '*')) {
			policy.skills = [{ type: 'selector', id: '*' }];
			return;
		}
		const existing = new Set((policy.skills ?? []).map((resource) => resource.id));
		policy.skills = [
			...(policy.skills ?? []).filter((resource) => resource.id !== '*'),
			...resources.filter((resource) => !existing.has(resource.id))
		];
	}

	function addModels(modelIDs: string[]) {
		if (modelIDs.includes('*')) {
			policy.models = [{ id: '*' }];
			return;
		}
		const existing = new Set((policy.models ?? []).map((model) => model.id));
		policy.models = [
			...(policy.models ?? []).filter((model) => model.id !== '*'),
			...modelIDs.filter((id) => !existing.has(id)).map((id) => ({ id }))
		];
	}

	function addHostedAgents(resources: HostedAgentAccessPolicyResource[]) {
		if (resources.some((resource) => resource.type === 'selector' && resource.id === '*')) {
			policy.hostedAgents = [{ type: 'selector', id: '*' }];
			return;
		}
		const existing = new Set((policy.hostedAgents ?? []).map((resource) => resource.id));
		policy.hostedAgents = [
			...(policy.hostedAgents ?? []).filter((resource) => resource.id !== '*'),
			...resources.filter((resource) => !existing.has(resource.id))
		];
	}

	function manifest(): AccessPolicyManifest {
		if (workspaceID) {
			return {
				displayName: policy.displayName.trim(),
				mcpServers: policy.mcpServers ?? [],
				subjects: policy.subjects ?? []
			};
		}
		return {
			displayName: policy.displayName.trim(),
			hostedAgents: policy.hostedAgents ?? [],
			mcpCatalogID:
				(policy.mcpServers?.length ?? 0) > 0
					? policy.mcpCatalogID || DEFAULT_MCP_CATALOG_ID
					: policy.mcpCatalogID,
			mcpServers: policy.mcpServers ?? [],
			models: policy.models ?? [],
			skills: policy.skills ?? [],
			subjects: policy.subjects ?? []
		};
	}

	async function save() {
		if (!valid || locked) return;
		saving = true;
		try {
			if (policy.id) {
				const updated = workspaceID
					? await UserService.updateWorkspaceAccessPolicy(workspaceID, policy.id, manifest())
					: await AdminService.updateAccessPolicy(policy.id, manifest());
				policy = { ...updated };
				onUpdate?.(updated);
			} else {
				const created = workspaceID
					? await UserService.createWorkspaceAccessPolicy(workspaceID, manifest())
					: await AdminService.createAccessPolicy(manifest());
				onCreate?.(created);
			}
		} finally {
			saving = false;
		}
	}

	function removeSubject(id: string) {
		policy.subjects = (policy.subjects ?? []).filter((subject) => subject.id !== id);
	}
</script>

<div class="flex h-full flex-col gap-6">
	<div class="flex items-start justify-between gap-4">
		<div class="max-w-2xl">
			<h2 class="text-xl font-semibold">{policy.id ? policy.displayName : 'New access policy'}</h2>
			<p class="text-muted-content mt-1 text-sm">
				{workspaceID
					? 'This workspace policy grants access to MCP servers in its registry.'
					: 'One subject set can grant access across MCP servers, skills, models, and hosted agents.'}
			</p>
		</div>
		{#if policy.id && !locked}
			<IconButton onclick={() => (deleting = true)} variant="danger2">
				<Trash2 class="size-4" />
			</IconButton>
		{/if}
	</div>

	{#if policy.generated}
		<div class="alert alert-info text-sm">This policy is generated and cannot be edited.</div>
	{/if}

	<div class="paper p-4">
		<label class="form-control">
			<span class="label-text mb-1 text-sm font-light">Policy name</span>
			<input class="w-full input-text-filled" bind:value={policy.displayName} disabled={locked} />
		</label>
	</div>

	<section class="paper p-4 gap-2">
		<div class="mb-4 flex items-center justify-between">
			<div>
				<h3 class="font-semibold">Users & Groups</h3>
				<p class="text-muted-content text-sm">Users, groups, or everyone in the organization.</p>
			</div>
			{#if !locked}
				<button
					class="btn btn-primary btn-sm"
					aria-label="Add user or group"
					onclick={() => searchUsers?.open()}
				>
					<Plus class="size-4" /> Add
				</button>
			{/if}
		</div>
		<div class="flex flex-wrap gap-2">
			{#each policy.subjects ?? [] as subject (subject.id)}
				<span class="badge badge-lg badge-outline gap-2">
					{subject.id === '*' ? 'All users' : subject.id}
					{#if !locked}<button aria-label="Remove subject" onclick={() => removeSubject(subject.id)}
							>×</button
						>{/if}
				</span>
			{:else}
				<span class="text-muted-content text-sm">No subjects selected.</span>
			{/each}
		</div>
	</section>

	{#if loadingResources}
		<div class="flex justify-center py-12"><Loading /></div>
	{:else}
		<div class="grid gap-4 xl:grid-cols-2">
			{@render resourceCard(
				'MCP servers',
				policy.mcpServers ?? [],
				() => searchMCPServers?.open(),
				(id) => (policy.mcpServers = (policy.mcpServers ?? []).filter((r) => r.id !== id))
			)}
			{#if !workspaceID}
				{@render resourceCard(
					'Skills',
					policy.skills ?? [],
					() => searchSkills?.open(),
					(id) => (policy.skills = (policy.skills ?? []).filter((r) => r.id !== id))
				)}
				{@render resourceCard(
					'Models',
					policy.models ?? [],
					() => searchModels?.open(),
					(id) => (policy.models = (policy.models ?? []).filter((r) => r.id !== id))
				)}
				{@render resourceCard(
					'Hosted agents',
					policy.hostedAgents ?? [],
					() => searchHostedAgents?.open(),
					(id) => (policy.hostedAgents = (policy.hostedAgents ?? []).filter((r) => r.id !== id))
				)}
			{/if}
		</div>
	{/if}

	<div class="flex grow"></div>

	{#if !locked}
		<div class="sticky bottom-0 left-0 w-full bg-base-200 dark:bg-base-100 p-4">
			<div class="flex justify-end gap-4">
				<button class="btn btn-secondary">Cancel</button>
				<button class="btn btn-primary" disabled={saving} onclick={save}>
					{#if saving}<Loading />{:else}Save{/if}
				</button>
			</div>
		</div>
	{/if}
</div>

{#snippet resourceCard(
	title: string,
	resources: Array<
		| AccessControlRuleResource
		| SkillAccessPolicyResource
		| ModelResource
		| HostedAgentAccessPolicyResource
	>,
	open: () => void,
	remove: (id: string) => void
)}
	<section class="paper p-4 gap-2">
		<div class="mb-4 flex items-center justify-between gap-3">
			<div>
				<h3 class="font-semibold">{title}</h3>
			</div>
			{#if !locked}<button class="btn btn-primary btn-sm" aria-label="Add resource" onclick={open}
					><Plus class="size-4" /> Add</button
				>{/if}
		</div>
		<div class="flex min-h-8 flex-wrap gap-2">
			{#each resources as resource (resource.id)}
				<span class="badge badge-lg badge-outline max-w-full gap-2"
					><span class="truncate"
						>{resource.id === '*' ? `All ${title.toLowerCase()}` : resource.id}</span
					>{#if !locked}<button
							aria-label={`Remove ${resource.id}`}
							onclick={() => remove(resource.id)}>×</button
						>{/if}</span
				>
			{:else}<span class="text-muted-content text-sm">None selected.</span>{/each}
		</div>
	</section>
{/snippet}

<SearchUsers
	bind:this={searchUsers}
	filterIds={(policy.subjects ?? []).map((s) => s.id)}
	onAdd={addSubjects}
/>
<SearchMcpServers
	bind:this={searchMCPServers}
	type="acr"
	entity={workspaceID ? 'workspace' : 'catalog'}
	workspaceId={workspaceID}
	isAdminView={true}
	exclude={(policy.mcpServers ?? []).map((r) => r.id)}
	mcpEntriesContextFn={() => mcpServersAndEntries.current}
	onAdd={addMCPServers}
/>
<SearchSkills
	bind:this={searchSkills}
	{skills}
	{skillRepositories}
	exclude={(policy.skills ?? []).map((r) => r.id)}
	onAdd={addSkills}
/>
<SearchModels
	bind:this={searchModels}
	{models}
	defaultAliases={defaultModelAliases.current}
	exclude={(policy.models ?? []).map((r) => r.id)}
	onAdd={addModels}
/>
<SearchHostedAgents
	bind:this={searchHostedAgents}
	{hostedAgents}
	exclude={(policy.hostedAgents ?? []).map((r) => r.id)}
	onAdd={addHostedAgents}
/>

<Confirm
	msg={`Delete ${policy.displayName || 'this policy'}?`}
	show={deleting}
	onsuccess={async () => {
		if (!policy.id) return;
		if (workspaceID) await UserService.deleteWorkspaceAccessPolicy(workspaceID, policy.id);
		else await AdminService.deleteAccessPolicy(policy.id);
		goto('/admin/access-policies');
	}}
	oncancel={() => (deleting = false)}
/>
