<script lang="ts">
	import Confirm from '$lib/components/Confirm.svelte';
	import ResponsiveDialog from '$lib/components/ResponsiveDialog.svelte';
	import { DEFAULT_MCP_CATALOG_ID } from '$lib/constants';
	import Loading from '$lib/icons/Loading.svelte';
	import {
		AdminService,
		type CatalogComponentServer,
		type MCPCatalogEntry,
		type RuntimeFormData
	} from '$lib/services';
	import { initVMcp } from '$lib/services/vmcps/utils';
	import { errors, mcpServersAndEntries } from '$lib/stores';
	import { success } from '$lib/stores/success';
	import { twMerge } from 'tailwind-merge';

	interface Props {
		onCreated?: (created: MCPCatalogEntry) => void | Promise<void>;
		onDeleted?: (deleted: MCPCatalogEntry) => void | Promise<void>;
	}

	let { onCreated, onDeleted }: Props = $props();

	let creatingVMcp = $state<RuntimeFormData>(initVMcp());
	let showRequired = $state<Record<string, boolean>>({});
	let saving = $state(false);

	let createVMcpDialog = $state<ReturnType<typeof ResponsiveDialog>>();
	let editVMcpDialog = $state<ReturnType<typeof ResponsiveDialog>>();
	let selectedVMcp = $state<MCPCatalogEntry>();
	let editingVMcp = $state<RuntimeFormData>();

	let confirmDeleteVMcp = $state<MCPCatalogEntry>();
	let deletingVMcp = $state(false);

	async function handleCreateVMcp() {
		showRequired = {};
		if (creatingVMcp.name.trim() === '') {
			showRequired.name = true;
		}

		if (!creatingVMcp.shortDescription || creatingVMcp.shortDescription.trim() === '') {
			showRequired.shortDescription = true;
		}

		if (Object.keys(showRequired).length > 0) {
			return;
		}

		await saveVMcp();
	}

	async function saveVMcp() {
		saving = true;
		try {
			const composite = await AdminService.createMCPCatalogEntry(
				DEFAULT_MCP_CATALOG_ID,
				creatingVMcp
			);

			await mcpServersAndEntries.refreshEntries();
			success.add(`${composite.manifest.name} vMCP added.`);

			closeCreate();

			const created =
				mcpServersAndEntries.current.entries.find((entry) => entry.id === composite.id) ??
				composite;
			await onCreated?.(created);
		} finally {
			saving = false;
		}
	}

	export function openCreate(componentServers: CatalogComponentServer[] = []) {
		if (saving) return;
		closeEdit();
		creatingVMcp = {
			...initVMcp(),
			compositeConfig: { componentServers }
		};

		if (componentServers.length === 1) {
			creatingVMcp.name = componentServers[0].manifest?.name ?? '';
			creatingVMcp.shortDescription = componentServers[0].manifest?.shortDescription ?? '';
		}

		showRequired = {};
		createVMcpDialog?.open();
	}

	export function openDelete(vmcp: MCPCatalogEntry) {
		selectedVMcp = vmcp;
		confirmDeleteVMcp = vmcp;
	}

	function closeCreate() {
		creatingVMcp = initVMcp();
		showRequired = {};
		createVMcpDialog?.close();
	}

	function vmcpToFormData(vmcp: MCPCatalogEntry): RuntimeFormData {
		const manifest = vmcp.manifest;
		return {
			...initVMcp(),
			...manifest,
			name: manifest.name ?? '',
			shortDescription: manifest.shortDescription ?? '',
			description: manifest.description ?? '',
			icon: manifest.icon ?? '',
			env: manifest.env ?? [],
			categories: manifest.metadata?.categories?.split(',').filter(Boolean) ?? ['']
		};
	}

	export function openEdit(vmcp: MCPCatalogEntry) {
		closeCreate();
		selectedVMcp = vmcp;
		editingVMcp = vmcpToFormData(vmcp);
		showRequired = {};
		editVMcpDialog?.open();
	}

	function closeEdit() {
		selectedVMcp = undefined;
		editingVMcp = undefined;
		showRequired = {};
		editVMcpDialog?.close();
	}

	async function handleDeleteVMcp() {
		if (!confirmDeleteVMcp) return;

		const deleted = confirmDeleteVMcp;
		deletingVMcp = true;
		try {
			await AdminService.deleteMCPCatalogEntry(DEFAULT_MCP_CATALOG_ID, deleted.id);
			mcpServersAndEntries.current.entries = mcpServersAndEntries.current.entries.filter(
				(entry) => entry.id !== deleted.id
			);
			if (selectedVMcp?.id === deleted.id) {
				closeEdit();
			}
			success.add(`${deleted.manifest.name} vMCP deleted.`);
			await onDeleted?.(deleted);
		} catch {
			errors.append('Failed to delete vMCP.');
		} finally {
			deletingVMcp = false;
			confirmDeleteVMcp = undefined;
			mcpServersAndEntries.refreshEntries();
		}
	}

	async function handleUpdateVMcp() {
		if (!selectedVMcp || !editingVMcp) return;

		showRequired = {};
		if (editingVMcp.name.trim() === '') {
			showRequired.name = true;
		}
		if (!editingVMcp.shortDescription?.trim()) {
			showRequired.shortDescription = true;
		}
		if (Object.keys(showRequired).length > 0) return;

		saving = true;
		try {
			const updatedVMcp = await AdminService.updateMCPCatalogEntry(
				DEFAULT_MCP_CATALOG_ID,
				selectedVMcp.id,
				editingVMcp
			);

			mcpServersAndEntries.current.entries = mcpServersAndEntries.current.entries.map((entry) =>
				entry.id === updatedVMcp.id ? updatedVMcp : entry
			);
			success.add(`${updatedVMcp.manifest.name} vMCP updated.`);
			closeEdit();
		} finally {
			saving = false;
		}
	}

	function updateRequired(field: string) {
		delete showRequired[field];
	}
</script>

<Confirm
	show={Boolean(confirmDeleteVMcp)}
	onsuccess={handleDeleteVMcp}
	oncancel={() => (confirmDeleteVMcp = undefined)}
	msg=""
	loading={deletingVMcp}
	title="Confirm Delete"
>
	{#snippet note()}
		Are you sure you want to delete "<b>{confirmDeleteVMcp?.manifest.name ?? 'this vMCP'}</b>"? This
		cannot be undone.
	{/snippet}
</Confirm>

<ResponsiveDialog
	animate="slide"
	class="w-md"
	bind:this={createVMcpDialog}
	title="Create vMCP"
	onClose={closeCreate}
>
	<div class="mb-4 flex flex-col gap-1">
		<label
			for="create-vmcp-name"
			class={twMerge('text-sm font-light', showRequired.name && 'error')}
		>
			Name <span class={showRequired.name ? 'text-error' : ''} aria-hidden="true">*</span>
		</label>
		<input
			id="create-vmcp-name"
			class={twMerge('text-input-filled', showRequired.name && 'error')}
			bind:value={creatingVMcp.name}
			aria-required="true"
			oninput={() => updateRequired('name')}
		/>
		{#if showRequired.name}
			<p class="text-error text-xs" role="alert">Name is required</p>
		{/if}
	</div>

	<div class="flex flex-col gap-1">
		<label
			for="create-vmcp-description"
			class={twMerge('text-sm font-light', showRequired.shortDescription && 'error')}
		>
			Description
			<span class={showRequired.shortDescription ? 'text-error' : ''} aria-hidden="true">*</span>
		</label>
		<textarea
			id="create-vmcp-description"
			rows="3"
			class={twMerge('text-input-filled resize-none', showRequired.shortDescription && 'error')}
			bind:value={creatingVMcp.shortDescription}
			aria-required="true"
			oninput={() => updateRequired('shortDescription')}
		></textarea>
		{#if showRequired.shortDescription}
			<p class="text-error text-xs" role="alert">Description is required</p>
		{/if}
	</div>

	<div class="flex justify-end gap-2 mt-4">
		<button class="btn btn-ghost btn-sm text-xs" onclick={closeCreate} disabled={saving}>
			Cancel
		</button>
		<button class="btn btn-primary btn-sm text-xs" onclick={handleCreateVMcp} disabled={saving}>
			{#if saving}
				<Loading class="text-primary-content size-4" />
			{:else}
				Create
			{/if}
		</button>
	</div>
</ResponsiveDialog>

<ResponsiveDialog class="w-md" bind:this={editVMcpDialog} title="Edit vMCP" onClose={closeEdit}>
	{#if editingVMcp}
		<div class="mb-4 flex flex-col gap-1">
			<label
				for="edit-vmcp-name"
				class={twMerge('text-sm font-light', showRequired.name && 'error')}
			>
				Name <span class={showRequired.name ? 'text-error' : ''} aria-hidden="true">*</span>
			</label>
			<input
				id="edit-vmcp-name"
				class={twMerge('text-input-filled', showRequired.name && 'error')}
				bind:value={editingVMcp.name}
				aria-required="true"
				oninput={() => updateRequired('name')}
			/>
			{#if showRequired.name}
				<p class="text-error text-xs" role="alert">Name is required</p>
			{/if}
		</div>

		<div class="flex flex-col gap-1">
			<label
				for="edit-vmcp-description"
				class={twMerge('text-sm font-light', showRequired.shortDescription && 'error')}
			>
				Description
				<span class={showRequired.shortDescription ? 'text-error' : ''} aria-hidden="true">*</span>
			</label>
			<textarea
				id="edit-vmcp-description"
				rows="3"
				class={twMerge('text-input-filled resize-none', showRequired.shortDescription && 'error')}
				bind:value={editingVMcp.shortDescription}
				aria-required="true"
				oninput={() => updateRequired('shortDescription')}
			></textarea>
			{#if showRequired.shortDescription}
				<p class="text-error text-xs" role="alert">Description is required</p>
			{/if}
		</div>

		<div class="flex justify-end gap-2 mt-4">
			<button class="btn btn-ghost btn-sm text-xs" onclick={closeEdit} disabled={saving}>
				Cancel
			</button>
			<button class="btn btn-primary btn-sm text-xs" onclick={handleUpdateVMcp} disabled={saving}>
				{#if saving}
					<Loading class="text-primary-content size-4" />
				{:else}
					Save
				{/if}
			</button>
		</div>
	{/if}
</ResponsiveDialog>
