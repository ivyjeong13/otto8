<script module lang="ts">
	import type { OrgGroup, ToolOverride } from '$lib/services';
	import { SvelteMap } from 'svelte/reactivity';

	type ProfileSubject = OrgUser | OrgGroup;
	type ProfileResource = { id: string; toolOverrides: ToolOverride[] };
	type ProfileManifest = {
		name: string;
		users: ProfileSubject[];
		resources: ProfileResource[];
	};
	type Profile = ProfileManifest & { id: string };

	// Prototype storage: profiles survive tab changes, but intentionally do not persist or affect
	// runtime authorization until the server-side profile model exists.
	const profilesByVMcp = new SvelteMap<string, Profile[]>();
</script>

<script lang="ts">
	import Select from '$lib/components/Select.svelte';
	import type { VMcpToolFlow } from '$lib/runes/vmcps/vmcpToolFlow.svelte';
	import {
		UserService,
		type CatalogComponentServer,
		type MCPCatalogEntry,
		type OrgUser
	} from '$lib/services';
	import { getUserRoleLabel, isInteractiveChildEvent } from '$lib/utils';
	import IconButton from '../primitives/IconButton.svelte';
	import { ArrowLeft, Pencil, Plus, Server, Split, Trash2, UsersRound, X } from '@lucide/svelte';
	import { fly, slide } from 'svelte/transition';

	interface Props {
		vmcp?: MCPCatalogEntry;
		toolFlow: VMcpToolFlow;
	}

	let { vmcp, toolFlow }: Props = $props();
	let profiles = $state<Profile[]>([]);
	let draft = $state<ProfileManifest>();
	let editingId = $state<string>();
	let error = $state('');
	let directoryUsers = $state<OrgUser[]>([]);
	let directoryGroups = $state<OrgGroup[]>([]);
	let subjectQuery = $state('');

	const EVERYONE_GROUP: OrgGroup = { id: '*', name: 'All Obot Users' };
	const GROUP_PAGE_SIZE = 50;

	const componentServers = $derived(vmcp?.manifest.compositeConfig?.componentServers ?? []);
	const assignedSubjectIds = $derived(new Set(draft?.users.map((subject) => subject.id) ?? []));
	const subjectOptions = $derived.by(() => {
		const query = subjectQuery.trim().toLowerCase();
		const everyoneMatches = !query || EVERYONE_GROUP.name.toLowerCase().includes(query);
		const users = query
			? directoryUsers.filter(
					(user) =>
						(user.displayName ?? '').toLowerCase().includes(query) ||
						(user.email ?? '').toLowerCase().includes(query) ||
						(user.username ?? '').toLowerCase().includes(query)
				)
			: directoryUsers;
		const groups = everyoneMatches ? [EVERYONE_GROUP, ...directoryGroups] : directoryGroups;
		return [...groups, ...users]
			.filter((subject) => !assignedSubjectIds.has(subject.id))
			.map((subject) => ({
				id: subject.id,
				label: subjectName(subject),
				subject
			}));
	});

	let groupsRequest: AbortController | undefined;

	$effect(() => {
		if (!draft) return;
		void loadUsers();
	});

	$effect(() => {
		if (!draft) return;
		const query = subjectQuery;
		const timer = setTimeout(() => loadGroups(query), query ? 500 : 0);
		return () => {
			clearTimeout(timer);
			groupsRequest?.abort();
		};
	});

	$effect(() => {
		if (vmcp) {
			profiles = profilesByVMcp.get(vmcp.id)?.map(cloneProfile) ?? [];
			draft = undefined;
			editingId = undefined;
			error = '';
		}
	});

	function componentId(component: CatalogComponentServer) {
		return component.catalogEntryID ?? component.mcpServerID ?? '';
	}

	function componentName(component: CatalogComponentServer) {
		return component.manifest?.name ?? componentId(component) ?? 'MCP server';
	}

	function initialTools(component: CatalogComponentServer): ToolOverride[] {
		if (component.toolOverrides?.length) {
			return component.toolOverrides.map((tool) => ({ ...tool }));
		}
		return (component.manifest?.toolPreview ?? []).map((tool) => ({
			name: tool.name,
			description: tool.description,
			enabled: tool.enabled !== false
		}));
	}

	function cloneProfile<T extends ProfileManifest>(profile: T): T {
		return {
			...profile,
			users: [...profile.users],
			resources: profile.resources.map((resource) => ({
				...resource,
				toolOverrides: resource.toolOverrides.map((tool) => ({ ...tool }))
			}))
		};
	}

	function createProfile() {
		editingId = undefined;
		error = '';
		draft = {
			name: '',
			users: [],
			resources: componentServers
				.map((component) => ({
					id: componentId(component),
					toolOverrides: initialTools(component)
				}))
				.filter((resource) => resource.id)
		};
	}

	function editProfile(profile: Profile) {
		editingId = profile.id;
		error = '';
		draft = cloneProfile(profile);
	}

	function cancelEditing() {
		draft = undefined;
		editingId = undefined;
		error = '';
	}

	function saveProfile() {
		if (!draft || !vmcp) return;
		const name = draft.name.trim();
		if (!name) {
			error = 'Enter a profile name.';
			return;
		}
		if (profiles.some((profile) => profile.id !== editingId && profile.name.trim() === name)) {
			error = 'A profile with this name already exists.';
			return;
		}

		const profile: Profile = {
			id: editingId ?? crypto.randomUUID(),
			...cloneProfile({ ...draft, name })
		};
		profiles = editingId
			? profiles.map((candidate) => (candidate.id === editingId ? profile : candidate))
			: [...profiles, profile];
		profilesByVMcp.set(vmcp.id, profiles.map(cloneProfile));
		cancelEditing();
	}

	function deleteProfile(id: string) {
		if (!vmcp) return;
		profiles = profiles.filter((profile) => profile.id !== id);
		profilesByVMcp.set(vmcp.id, profiles.map(cloneProfile));
		if (editingId === id) cancelEditing();
	}

	function isGroup(subject: ProfileSubject): subject is OrgGroup {
		return 'name' in subject;
	}

	function subjectName(subject: ProfileSubject) {
		return isGroup(subject)
			? subject.name
			: (subject.displayName ?? subject.email ?? subject.username ?? subject.id);
	}

	function userInitials(user: OrgUser) {
		const source = user.email || user.username || user.displayName || '';
		if (!source) return '?';
		const local = source.includes('@') ? source.split('@')[0] : source;
		const parts = local.split(/[.\-\s]/).filter(Boolean);
		if (parts.length === 0) return '?';
		let initials = parts[0].charAt(0).toUpperCase();
		if (parts.length > 1) {
			initials += parts[parts.length - 1].charAt(0).toUpperCase();
		}
		return initials;
	}

	function addSubject(subject: ProfileSubject) {
		if (!draft) return;
		if (draft.users.some((candidate) => candidate.id === subject.id)) return;
		draft.users = [...draft.users, subject];
	}

	function removeSubject(id: string) {
		if (draft) draft.users = draft.users.filter((subject) => subject.id !== id);
	}

	async function loadUsers() {
		if (directoryUsers.length > 0) return;
		try {
			directoryUsers = await UserService.listUsers();
		} catch (err) {
			console.error('Failed to load users:', err);
		}
	}

	async function loadGroups(query: string) {
		groupsRequest?.abort();
		const controller = new AbortController();
		groupsRequest = controller;
		try {
			const page = await UserService.listGroups({
				query: query.trim() || undefined,
				limit: GROUP_PAGE_SIZE,
				signal: controller.signal
			});
			if (controller.signal.aborted) return;
			directoryGroups = [...page.items].sort((a, b) => a.name.localeCompare(b.name));
		} catch (err) {
			if (controller.signal.aborted) return;
			console.error('Failed to load groups:', err);
			directoryGroups = [];
		}
	}

	function resourceFor(id: string) {
		return draft?.resources.find((resource) => resource.id === id);
	}

	function enabledToolCount(resource: ProfileResource) {
		return resource.toolOverrides.filter((tool) => tool.enabled !== false).length;
	}

	function enabledTools(resource: ProfileResource) {
		return resource.toolOverrides.filter((tool) => tool.enabled !== false);
	}

	function disabledToolOptions(resource: ProfileResource) {
		return resource.toolOverrides
			.filter((tool) => tool.enabled === false)
			.map((tool) => ({
				id: tool.name,
				label: tool.overrideName || tool.name
			}));
	}

	function setToolEnabled(resourceId: string, toolName: string, enabled: boolean) {
		if (!draft) return;
		draft.resources = draft.resources.map((resource) =>
			resource.id !== resourceId
				? resource
				: {
						...resource,
						toolOverrides: resource.toolOverrides.map((tool) =>
							tool.name === toolName ? { ...tool, enabled } : tool
						)
					}
		);
	}

	function refineTools(event: MouseEvent, component: CatalogComponentServer) {
		event.preventDefault();
		event.stopPropagation();
		if (!vmcp) return;
		toolFlow.collectComponentTools(component, vmcp, (config) => {
			if (!draft) return;
			const id = componentId(component);
			draft.resources = draft.resources.map((resource) =>
				resource.id === id
					? {
							...resource,
							toolOverrides: (config.toolOverrides ?? []).map((tool) => ({
								...tool,
								enabled: false
							}))
						}
					: resource
			);
		});
	}
</script>

<div class="h-full w-full overflow-y-auto p-4 pt-18">
	{#if draft}
		<div class="mx-auto w-full max-w-4xl">
			{@render editCreate()}
		</div>
	{:else if vmcp}
		{@render actions()}
		{@render list()}
	{:else}
		<div class="flex flex-col items-center justify-center text-center">
			<div
				class="bg-primary/10 text-primary mb-4 flex size-9 items-center justify-center rounded-md"
			>
				<UsersRound class="size-4" />
			</div>
			<h2 class="font-semibold">No profiles yet</h2>
			<p class="text-muted-content mt-1 max-w-sm text-xs">
				In order to create profiles, you must first create a vMCP.
			</p>
		</div>
	{/if}
</div>

{#snippet actions()}
	{#if !draft}
		<div class="absolute top-4 right-4 z-50">
			<div
				class="bg-base-100/80 dark:bg-base-300/80 flex gap-1 rounded-md border border-transparent p-1 shadow-sm"
				data-vmcp-ui
				role="toolbar"
				tabindex="-1"
				aria-label="Create profile"
				onpointerdown={(event) => event.stopPropagation()}
			>
				<IconButton
					class="btn-sm"
					tooltip={{ text: 'Create vMCP', placement: 'bottom' }}
					onclick={() => {
						createProfile();
					}}
				>
					<Plus class="size-4" />
				</IconButton>
			</div>
		</div>
	{/if}
{/snippet}

{#snippet editCreate()}
	{#if draft}
		<form
			class="flex flex-col gap-3 border-base-300 bg-base-100 dark:bg-base-300 rounded-xl border p-5 shadow-sm"
			in:fly|global={{ x: 48, duration: 180 }}
			onsubmit={(event) => {
				event.preventDefault();
				saveProfile();
			}}
		>
			<header class="flex items-start gap-3">
				<IconButton tooltip={{ text: 'Back to profiles' }} onclick={cancelEditing}>
					<ArrowLeft class="size-4" />
				</IconButton>
				<div>
					<h2 class="text-md font-semibold">{editingId ? 'Edit profile' : 'Create profile'}</h2>
					<p class="text-muted-content text-xs">
						Set up a profile to define what tools a set of groups or users can have available to
						them.
					</p>
				</div>
			</header>

			<div class="divider my-0"></div>

			<section>
				<label class="flex flex-col gap-0.5" for="profile-name">
					<span class="text-xs font-light">Name</span>
					<input
						id="profile-name"
						class="input-text-filled text-sm"
						placeholder="ex. Marketing, Engineering, etc."
						autocomplete="off"
						bind:value={draft.name}
						oninput={() => (error = '')}
					/>
				</label>
				{#if error}
					<p class="text-error mt-2 text-sm" role="alert">{error}</p>
				{/if}
			</section>

			<section>
				<div class="divider my-0 text-sm font-semibold mb-3 mt-1">MCP Servers</div>
				<div class="mb-4">
					<p class="text-muted-content text-xs font-light">
						By default, all MCP servers have tools enabled by default. Modify the tools available
						for this profile below.
					</p>
				</div>
				{#if componentServers.length === 0}
					<div class="text-muted-content rounded-lg p-5 text-center text-sm">
						No MCP servers available.
					</div>
				{:else}
					<div class="flex flex-col gap-1">
						{#each componentServers as component (componentId(component))}
							{@const id = componentId(component)}
							{@const resource = resourceFor(id)}
							<div class="border-base-300 dark:border-base-400 overflow-hidden rounded-lg border">
								<label class="flex items-center gap-3 py-1 pl-3 pr-1">
									{#if component.manifest?.icon}
										<img src={component.manifest.icon} alt="" class="size-5" />
									{:else}
										<div class="icon">
											<Server class="size-5" />
										</div>
									{/if}
									<span class="grow font-medium text-xs">{componentName(component)}</span>
									{#if resource}
										{#if resource.toolOverrides.length > 0}
											<div class="inline-flex items-center gap-1 py-2">
												<span class="text-muted-content text-xs">
													{enabledToolCount(resource)} of {resource.toolOverrides.length} tools
												</span>
											</div>
										{:else}
											<IconButton
												class="size-8"
												type="button"
												tooltip={{ text: 'Refine tools' }}
												onclick={(event) => refineTools(event, component)}
											>
												<Split class="size-4" />
											</IconButton>
										{/if}
									{/if}
								</label>
								{#if resource && resource.toolOverrides.length > 0}
									{@const disabledOptions = disabledToolOptions(resource)}
									<div
										in:slide={{ axis: 'y', duration: 150 }}
										class="border-base-300 bg-base-200/35 dark:bg-base-200 flex flex-col border-t p-2"
									>
										{#if disabledOptions.length > 0}
											<Select
												id={`profile-disabled-tools-${id}`}
												options={disabledOptions}
												searchInDropdown
												placeholder="Add tools..."
												searchPlaceholder="Search tools..."
												class="text-xs bg-base-300 dark:bg-base-100 shadow-inner!"
												classes={{ root: 'w-full', option: 'text-xs' }}
												onSelect={(option) => setToolEnabled(id, String(option.id), true)}
											/>
										{/if}
										{#each enabledTools(resource) as tool, index (tool.name)}
											<div
												out:fly={{ x: 100, duration: 100 }}
												class="flex items-center gap-4 p-2 text-sm mt-2"
											>
												<span class="min-w-0 grow">
													<span class="block truncate font-medium text-xs"
														>{tool.overrideName || tool.name}</span
													>
													{#if tool.overrideDescription || tool.description}
														<span class="text-muted-content line-clamp-2 text-xs">
															{tool.overrideDescription || tool.description}
														</span>
													{/if}
												</span>
												<IconButton
													class="size-8"
													type="button"
													variant="danger"
													tooltip={{ text: 'Remove tool' }}
													onclick={() => setToolEnabled(id, tool.name, false)}
												>
													<X class="size-4" />
												</IconButton>
											</div>
											{#if index < enabledTools(resource).length - 1}
												<div class="divider my-0 after:h-px before:h-px px-2"></div>
											{/if}
										{/each}
									</div>
								{/if}
							</div>
						{/each}
					</div>
				{/if}
			</section>

			<section>
				<div class="divider my-0 text-sm font-semibold mb-3 mt-1">Identities</div>
				<div class="mb-4">
					<p class="text-muted-content text-xs font-light">
						Assign members to this profiles. They will inherit the tools assigned to the profile.
					</p>
				</div>
				<Select
					id="profile-subjects"
					options={subjectOptions}
					bind:query={subjectQuery}
					searchInDropdown
					placeholder="Add people or groups"
					searchPlaceholder="Search users or groups..."
					class="text-xs bg-base-200 shadow-inner!"
					classes={{ root: 'w-full', option: 'text-xs' }}
					onSelect={(option) => addSubject(option.subject)}
				/>
				{#if draft.users.length === 0}
					<div class="text-muted-content text-center pb-4 pt-3 text-xs italic font-light">
						No people or groups assigned.
					</div>
				{:else}
					<div class="flex flex-col mt-2">
						{#each draft.users as subject, index (subject.id)}
							<div
								class="p-2 flex justify-between items-center"
								out:fly={{ x: 100, duration: 100 }}
							>
								<div class="flex items-center gap-2">
									{#if isGroup(subject)}
										<div
											class="bg-base-300 dark:bg-base-200 flex size-8 items-center justify-center rounded-full text-[8px] font-medium text-white"
										>
											<UsersRound class="size-4" />
										</div>
									{:else if subject.iconURL}
										<img
											src={subject.iconURL}
											alt=""
											class="size-4 rounded-full object-cover"
											referrerpolicy="no-referrer"
										/>
									{:else}
										<div
											class="bg-base-300 dark:bg-base-200 flex size-8 items-center justify-center rounded-full text-sm font-medium text-white"
										>
											{userInitials(subject)}
										</div>
									{/if}
									<div class="flex flex-col">
										<span class="text-xs font-light">{subjectName(subject)}</span>
										<span class="text-muted-content text-xs">
											{isGroup(subject)
												? 'Group'
												: subject.effectiveRole
													? getUserRoleLabel(subject.effectiveRole)
													: 'User'}
										</span>
									</div>
								</div>

								<IconButton
									class="size-8"
									tooltip={{ text: `Remove ${subjectName(subject)}` }}
									onclick={() => removeSubject(subject.id)}
									variant="danger"
								>
									<X class="size-4" />
								</IconButton>
							</div>
							{#if index < draft.users.length - 1}
								<div class="divider my-0 after:h-px before:h-px px-2"></div>
							{/if}
						{/each}
					</div>
				{/if}
			</section>

			<footer class="flex w-full">
				<button type="submit" class="btn btn-sm btn-primary text-xs w-full">
					{editingId ? 'Save changes' : 'Create profile'}
				</button>
			</footer>
		</form>
	{/if}
{/snippet}

{#snippet list()}
	{#if profiles.length === 0}
		<div class="flex flex-col items-center justify-center text-center">
			<div
				class="bg-primary/10 text-primary mb-4 flex size-9 items-center justify-center rounded-md"
			>
				<UsersRound class="size-4" />
			</div>
			<h2 class="font-semibold">No profiles yet</h2>
			<p class="text-muted-content mt-1 max-w-sm text-xs">
				Create a profile to group people and define the MCP tools available to them.
			</p>
			<button class="btn btn-primary btn-sm mt-5" onclick={createProfile}>
				<Plus class="size-4" />
				Create profile
			</button>
		</div>
	{:else}
		<div class="flex flex-col gap-2">
			{#each profiles as profile (profile.id)}
				<article
					class="border-base-300 bg-base-100 dark:bg-base-300 hover:border-primary/40 group rounded-xl border p-4 shadow-sm transition"
				>
					<button
						class="w-full text-left"
						aria-label={`Edit ${profile.name}`}
						onclick={() => editProfile(profile)}
						onkeydown={(event) => {
							if (isInteractiveChildEvent(event)) return;
						}}
					>
						<div class="flex items-start justify-between gap-3">
							<div class="min-w-0">
								<h3 class="truncate font-semibold">{profile.name}</h3>
								<p class="text-muted-content mt-1 text-xs">
									{profile.users.length}
									{profile.users.length === 1 ? 'member' : 'members'}
									&middot; {profile.resources.length}
									{profile.resources.length === 1 ? 'server' : 'servers'}
								</p>
							</div>
							<Pencil
								class="text-muted-content size-4 opacity-0 transition-opacity group-hover:opacity-100"
							/>
						</div>
					</button>
					<div class="border-base-300 mt-4 flex justify-end border-t pt-2">
						<IconButton
							variant="danger"
							class="btn-xs"
							tooltip={{ text: `Delete ${profile.name}`, placement: 'bottom' }}
							onclick={() => deleteProfile(profile.id)}
						>
							<Trash2 class="size-3.5" />
						</IconButton>
					</div>
				</article>
			{/each}
		</div>
	{/if}
{/snippet}
