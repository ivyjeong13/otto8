<script lang="ts">
	import { tooltip } from '$lib/actions/tooltip.svelte';
	import { toInlineHTMLFromMarkdown } from '$lib/markdown';
	import type { MCPCatalogEntry, MCPCatalogServer } from '$lib/services';
	import { serverHasMissingSecretBinding } from '$lib/services/user/mcp';
	import type { VMcpComponentView } from '$lib/services/vmcps/types';
	import { mcpServersAndEntries } from '$lib/stores';
	import McpServerIcon from './McpServerIcon.svelte';
	import VMcpCard from './VMcpCard.svelte';
	import { Layers, Server } from '@lucide/svelte';
	import type { Snippet } from 'svelte';

	const MAX_ICON_SLICES = 4;
	const CARD_STAGGER_MS = 30;
	const CARD_STAGGER_MAX_STEPS = 8;

	interface Props {
		items: MCPCatalogEntry[];
		components: (vmcp: MCPCatalogEntry) => VMcpComponentView[];
		onSelect?: (vmcp: MCPCatalogEntry) => void;
		onConnect?: (vmcp: MCPCatalogEntry) => void;
		onDelete?: (vmcp: MCPCatalogEntry) => void;
		noDataContent?: Snippet;
	}

	let { items, components, onSelect, onConnect, onDelete, noDataContent }: Props = $props();

	let cards = $derived(items.map(toCard));
	let overflowHiddenById = $state<Record<string, number>>({});

	const userConfiguredServersByEntry = $derived.by(() => {
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- not a reactive property
		const userConfiguredServersByEntry = new Map<string, MCPCatalogServer[]>();
		for (const server of mcpServersAndEntries.current.userConfiguredServers ?? []) {
			if (!server.catalogEntryID) continue;
			const existing = userConfiguredServersByEntry.get(server.catalogEntryID) ?? [];
			existing.push(server);
			userConfiguredServersByEntry.set(server.catalogEntryID, existing);
		}
		return userConfiguredServersByEntry;
	});

	type VMcpListCard = ReturnType<typeof toCard>;

	function toCard(item: MCPCatalogEntry) {
		const componentServers = components(item);
		const configuredServers = [...(userConfiguredServersByEntry.get(item.id) ?? [])].sort(
			(a, b) => new Date(b.created).getTime() - new Date(a.created).getTime()
		);
		return {
			id: item.id,
			name: item.manifest.name ?? 'Untitled vMCP',
			connected: configuredServers.some((s) => !serverHasMissingSecretBinding(item, s)),
			componentServers,
			tools: toolCounts(componentServers),
			descriptionHTML: toInlineHTMLFromMarkdown(item.manifest.shortDescription ?? ''),
			data: item
		};
	}

	/** Servers without tool overrides only report a preview, so those totals are approximate. */
	function toolCounts(componentServers: VMcpComponentView[]) {
		let enabled = 0;
		let total = 0;
		let approximate = false;
		for (const component of componentServers) {
			if (component.toolOverrides) {
				enabled += component.toolOverrides.filter((tool) => tool.enabled === true).length;
				total += component.toolOverrides.length;
				continue;
			}
			approximate = true;
			const previewCount = component.toolPreview?.length ?? 0;
			enabled += previewCount;
			total += previewCount;
		}
		return { enabled, total, approximate };
	}

	/**
	 * Lays the first few server icons out as one square: each slice clips a full-size icon down to
	 * the piece of the square it occupies, so the icons read as a single cut-up tile.
	 */
	function iconSlices(componentServers: VMcpComponentView[]) {
		if (componentServers.length === 1) {
			return [
				{
					component: componentServers[0],
					cell: 'inset-0',
					icon: 'inset-0 size-full p-1',
					glyph: 'size-5'
				}
			];
		}
		if (componentServers.length === 2) {
			return [
				{
					component: componentServers[0],
					cell: 'top-0 left-0 h-full w-1/2 border-r',
					icon: 'top-0 left-0 h-full w-[200%]',
					glyph: 'size-4'
				},
				{
					component: componentServers[1],
					cell: 'top-0 right-0 h-full w-1/2',
					icon: 'top-0 right-0 h-full w-[200%]',
					glyph: 'size-4'
				}
			];
		}
		const quadrants = [
			{ cell: 'top-0 left-0 border-r border-b', icon: 'top-0 left-0' },
			{ cell: 'top-0 right-0 border-b', icon: 'top-0 right-0' },
			{ cell: 'bottom-0 left-0 border-r', icon: 'bottom-0 left-0' },
			{ cell: 'bottom-0 right-0', icon: 'bottom-0 right-0' }
		];
		return componentServers.slice(0, MAX_ICON_SLICES).map((component, index) => ({
			component,
			cell: `h-1/2 w-1/2 ${quadrants[index].cell}`,
			icon: `h-[200%] w-[200%] ${quadrants[index].icon}`,
			glyph: 'size-3'
		}));
	}

	function cardDelay(index: number) {
		return Math.min(index, CARD_STAGGER_MAX_STEPS) * CARD_STAGGER_MS;
	}

	function setOverflowHidden(cardId: string, hidden: number) {
		if (overflowHiddenById[cardId] === hidden) return;
		overflowHiddenById[cardId] = hidden;
	}

	function overflowRow(node: HTMLElement, params: { count: number; cardId: string }) {
		let current = params;

		function chips() {
			return [...node.querySelectorAll<HTMLElement>('[data-chip]')];
		}

		function moreEl() {
			return node.querySelector<HTMLElement>('[data-more]');
		}

		function measure() {
			const items = chips();
			const more = moreEl();
			if (items.length === 0) {
				setOverflowHidden(current.cardId, 0);
				return;
			}

			for (const item of items) {
				item.hidden = false;
			}
			if (more) more.hidden = true;

			const available = node.clientWidth;
			const gap = Number.parseFloat(getComputedStyle(node).columnGap) || 8;
			const widths = items.map((item) => item.offsetWidth);

			let used = 0;
			let visible = 0;
			for (let i = 0; i < items.length; i++) {
				const next = used + (i > 0 ? gap : 0) + widths[i];
				if (next <= available + 0.5) {
					used = next;
					visible = i + 1;
				} else {
					break;
				}
			}

			if (visible === items.length) {
				setOverflowHidden(current.cardId, 0);
				return;
			}

			if (more) {
				more.hidden = false;
				more.textContent = `+${items.length - Math.max(visible, 1)} more`;
				const moreWidth = more.offsetWidth + gap;
				while (visible > 0 && used + moreWidth > available + 0.5) {
					visible -= 1;
					used -= widths[visible] + (visible > 0 ? gap : 0);
				}
			}

			if (visible < 1) visible = 1;
			for (let i = 0; i < items.length; i++) {
				items[i].hidden = i >= visible;
			}
			if (more) {
				const hidden = items.length - visible;
				more.hidden = hidden <= 0;
				if (hidden > 0) {
					more.textContent = `+${hidden} more`;
				}
			}
			setOverflowHidden(current.cardId, Math.max(items.length - visible, 0));
		}

		const observer = new ResizeObserver(measure);
		observer.observe(node);
		requestAnimationFrame(measure);
		return {
			update(next: { count: number; cardId: string }) {
				current = next;
				requestAnimationFrame(measure);
			},
			destroy() {
				observer.disconnect();
			}
		};
	}
</script>

<div class="@container">
	{#if cards.length === 0}
		<div class="flex h-full items-center justify-center">
			{#if noDataContent}
				{@render noDataContent()}
			{:else}
				<p class="text-muted-content text-sm font-light">No vMCPs available.</p>
			{/if}
		</div>
	{:else}
		<div class="grid grid-cols-1 items-start gap-4 @2xl:grid-cols-2 @5xl:grid-cols-3">
			{#each cards as card, index (card.id)}
				{@render vmcpCard(card, index)}
			{/each}
		</div>
	{/if}
</div>

{#snippet vmcpCard(card: VMcpListCard, index: number)}
	<VMcpCard
		id={card.id}
		name={card.name}
		descriptionHTML={card.data.manifest.shortDescription ? card.descriptionHTML : undefined}
		connectURL={card.data.connectURL}
		connectButtonId={`btn-connect-to-server-${card.id}`}
		connected={card.connected}
		selectAriaLabel={`Click to edit ${card.name}`}
		enterDelay={cardDelay(index)}
		onSelect={() => onSelect?.(card.data)}
		onConnect={() => onConnect?.(card.data)}
		onDelete={() => onDelete?.(card.data)}
		class="text-base-content border-base-300 dark:border-base-400 bg-base-100 dark:bg-base-300 group @container cursor-pointer gap-3 rounded-lg border p-3 shadow-xs transition-[transform,box-shadow,border-color] duration-150 hover:border-primary hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
	>
		{#snippet icon()}
			{@render vmcpIcon(card)}
		{/snippet}
		{@render serversPanel(card)}
	</VMcpCard>
{/snippet}

{#snippet vmcpIcon(card: VMcpListCard)}
	{@const slices = iconSlices(card.componentServers)}
	{@const hidden = card.componentServers.length - slices.length}
	<div class="relative size-10 shrink-0">
		<div class="bg-primary/10 text-primary absolute inset-0 overflow-hidden rounded-md">
			{#if slices.length === 0}
				<div class="flex size-full items-center justify-center">
					<Layers class="size-5" />
				</div>
			{:else}
				{#each slices as slice, sliceIndex (sliceIndex)}
					<div
						class={`border-base-100 dark:border-base-300 absolute overflow-hidden ${slice.cell}`}
						title={slice.component.name}
					>
						{#if slice.component.icon}
							<img
								src={slice.component.icon}
								alt=""
								class={`absolute max-w-none object-contain ${slice.icon}`}
								loading="lazy"
								decoding="async"
							/>
						{:else}
							<div class="flex size-full items-center justify-center">
								<Server class={slice.glyph} />
							</div>
						{/if}
					</div>
				{/each}
			{/if}
		</div>
		{#if hidden > 0}
			<span
				class="bg-primary text-primary-content ring-base-100 dark:ring-base-300 absolute -right-1 -bottom-1 rounded-full px-1 font-mono text-[10px] leading-4 ring-1"
			>
				+{hidden}
			</span>
		{/if}
	</div>
{/snippet}

{#snippet serverChip(component: VMcpComponentView, asRowChip = false)}
	<div
		data-chip={asRowChip ? true : undefined}
		data-name={asRowChip ? component.name : undefined}
		class="bg-base-100 dark:bg-base-300 border-base-300 dark:border-base-400 group-hover:border-primary/40 flex shrink-0 items-center gap-2 rounded-md border pr-2 transition-colors"
	>
		<McpServerIcon
			icon={component.icon}
			width={12}
			height={12}
			class="size-3"
			classes={{ root: 'rounded-r-none' }}
		/>
		<span class="text-xs whitespace-nowrap">{component.name}</span>
	</div>
{/snippet}

{#snippet serversPanel(card: VMcpListCard)}
	{@const hiddenCount = overflowHiddenById[card.id] ?? 0}
	{@const overflowed = hiddenCount > 0 ? card.componentServers.slice(-hiddenCount) : []}
	{#if card.componentServers.length === 0}
		<p class="text-muted-content py-2 text-center text-xs italic">
			No servers yet. Open this vMCP in the designer to add some.
		</p>
	{:else}
		<div
			class="flex flex-nowrap items-center gap-2 overflow-hidden"
			use:overflowRow={{ count: card.componentServers.length, cardId: card.id }}
		>
			{#each card.componentServers as component (component.key)}
				{@render serverChip(component, true)}
			{/each}
			{#snippet moreContent()}
				<div class="flex max-w-xs flex-wrap gap-1 text-left font-normal">
					{#each overflowed as component (component.key)}
						{@render serverChip(component)}
					{/each}
				</div>
			{/snippet}
			{#key hiddenCount}
				<div
					data-more
					hidden={hiddenCount <= 0}
					aria-label={hiddenCount > 0 ? `${hiddenCount} more servers` : undefined}
					class="border-base-400 text-muted-content flex shrink-0 items-center justify-center rounded-md border border-dashed px-1.5 py-1 font-mono text-xs whitespace-nowrap"
					use:tooltip={hiddenCount > 0
						? {
								snippet: moreContent,
								placement: 'top',
								classes: ['tooltip-surface', 'w-fit']
							}
						: undefined}
				></div>
			{/key}
		</div>
	{/if}
{/snippet}
