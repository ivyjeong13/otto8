<script lang="ts">
	import { resolve } from '$app/paths';
	import { tooltip } from '$lib/actions/tooltip.svelte';
	import { toInlineHTMLFromMarkdown } from '$lib/markdown';
	import type { MCPCatalogEntry } from '$lib/services';
	import { MCP_CONNECTION_INVALID_LICENSE_MESSAGE } from '$lib/services/user/constants';
	import { serverHasMissingSecretBinding } from '$lib/services/user/mcp';
	import type { VMcpComponentView } from '$lib/services/vmcps/types';
	import { mcpServersAndEntries, version } from '$lib/stores';
	import { isInteractiveChildEvent } from '$lib/utils';
	import DotDotDot from '../DotDotDot.svelte';
	import McpServerIcon from './McpServerIcon.svelte';
	import { ExternalLink, Layers, Server, Trash2 } from '@lucide/svelte';
	import type { Snippet } from 'svelte';
	import { fade } from 'svelte/transition';

	/** Slots in the card's mosaic icon: one server fills it, two halve it, three or four quarter it. */
	const MAX_ICON_SLICES = 4;
	const CARD_STAGGER_MS = 30;
	const CARD_STAGGER_MAX_STEPS = 8;

	interface Props {
		items: MCPCatalogEntry[];
		components: (vmcp: MCPCatalogEntry) => VMcpComponentView[];
		actions?: Snippet;
		onSelect?: (vmcp: MCPCatalogEntry) => void;
		onConnect?: (vmcp: MCPCatalogEntry) => void;
		onDelete?: (vmcp: MCPCatalogEntry) => void;
	}

	let { items, components, actions, onSelect, onConnect, onDelete }: Props = $props();

	let cards = $derived(items.map(toCard));
	let hasLicenseEntitlementViolations = $derived(
		(version.current.licenseEntitlementViolations || []).length > 0
	);

	type VMcpCard = ReturnType<typeof toCard>;

	function toCard(item: MCPCatalogEntry) {
		const componentServers = components(item);
		return {
			id: item.id,
			name: item.manifest.name ?? 'Untitled vMCP',
			connected: mcpServersAndEntries.current.userConfiguredServers.some(
				(s) => !serverHasMissingSecretBinding(item, s)
			),
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
				{ component: componentServers[0], cell: 'inset-0', icon: 'inset-0', glyph: 'size-5' }
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

	/** Hide chips that would wrap, leaving a "+N more" marker on the same line. */
	function overflowRow(node: HTMLElement, _count: number) {
		function chips() {
			return [...node.querySelectorAll<HTMLElement>('[data-chip]')];
		}

		function moreEl() {
			return node.querySelector<HTMLElement>('[data-more]');
		}

		function measure() {
			const items = chips();
			const more = moreEl();
			if (items.length === 0) return;

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

			if (visible === items.length) return;

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
					more.title = items
						.slice(visible)
						.map((item) => item.dataset.name ?? '')
						.filter(Boolean)
						.join(', ');
				}
			}
		}

		const observer = new ResizeObserver(measure);
		observer.observe(node);
		requestAnimationFrame(measure);
		return {
			update() {
				requestAnimationFrame(measure);
			},
			destroy() {
				observer.disconnect();
			}
		};
	}
</script>

<div class="absolute top-4 right-4 z-50 flex items-center gap-4">
	{#if actions}
		{@render actions()}
	{/if}
</div>
<div class="@container h-full w-full overflow-y-auto p-4 pt-18">
	{#if cards.length === 0}
		<div class="flex h-full items-center justify-center">
			<p class="text-muted-content text-sm font-light">No vMCPs to show.</p>
		</div>
	{:else}
		<div class="grid grid-cols-1 items-start gap-4 @2xl:grid-cols-2 @5xl:grid-cols-3">
			{#each cards as card, index (card.id)}
				{@render vmcpCard(card, index)}
			{/each}
		</div>
	{/if}
</div>

{#snippet vmcpCard(card: VMcpCard, index: number)}
	<div
		class="text-base-content border-base-300 dark:border-base-400 bg-base-100 dark:bg-base-300 group @container flex cursor-pointer flex-col gap-3 rounded-lg border p-3 shadow-xs transition-[transform,box-shadow,border-color] duration-150 hover:border-primary hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
		role="button"
		tabindex="0"
		aria-label={`Click to edit ${card.name}`}
		in:fade={{ delay: cardDelay(index), duration: 150 }}
		onkeydown={(e) => {
			if (isInteractiveChildEvent(e)) {
				return;
			}
			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault();
				e.stopPropagation();
				onSelect?.(card.data);
			}
		}}
		onclick={(e) => {
			if (!isInteractiveChildEvent(e)) {
				onSelect?.(card.data);
			}
		}}
	>
		<div class="flex items-start gap-2">
			{@render vmcpIcon(card)}
			<div class="min-w-0 grow">
				<div class="flex min-w-0 items-center gap-2">
					<p class="truncate text-sm font-semibold">{card.name}</p>
					{#if card.connected}
						<div class="badge badge-xs badge-secondary shrink-0 gap-1">
							<span class="status status-primary"></span>
							Connected
						</div>
					{/if}
				</div>
				{#if card.data.manifest.shortDescription}
					<p class="text-muted-content mt-0.5 line-clamp-2 text-xs font-light">
						<!-- eslint-disable-next-line svelte/no-at-html-tags -- sanitized by toInlineHTMLFromMarkdown -->
						{@html card.descriptionHTML}
					</p>
				{/if}
			</div>
			{@render cardMenu(card)}
		</div>

		{@render serversPanel(card)}

		<div
			use:tooltip={{
				text: hasLicenseEntitlementViolations ? MCP_CONNECTION_INVALID_LICENSE_MESSAGE : undefined
			}}
			id={`btn-connect-to-server-${card.id}`}
		>
			<button
				class="btn btn-sm bg-primary/10 hover:bg-primary hover:text-primary-content w-full border-transparent font-mono text-xs uppercase"
				disabled={hasLicenseEntitlementViolations}
				onclick={(e) => {
					e.stopPropagation();
					onConnect?.(card.data);
				}}
			>
				Connect
			</button>
		</div>
	</div>
{/snippet}

{#snippet vmcpIcon(card: VMcpCard)}
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

{#snippet serversPanel(card: VMcpCard)}
	{#if card.componentServers.length === 0}
		<p class="text-muted-content py-2 text-center text-xs italic">
			No servers yet. Open this vMCP in the designer to add some.
		</p>
	{:else}
		<div
			class="flex flex-nowrap items-center gap-2 overflow-hidden"
			use:overflowRow={card.componentServers.length}
		>
			{#each card.componentServers as component (component.key)}
				<div
					data-chip
					data-name={component.name}
					class="bg-base-100 dark:bg-base-300 border-base-300 dark:border-base-400 group-hover:border-primary/40 flex shrink-0 items-center gap-2 rounded-md border pr-2 transition-colors"
					title={component.description || component.name}
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
			{/each}
			<div
				data-more
				hidden
				class="border-base-400 text-muted-content flex shrink-0 items-center justify-center rounded-md border border-dashed px-1.5 py-1 font-mono text-xs whitespace-nowrap"
			></div>
		</div>
	{/if}
{/snippet}

{#snippet cardMenu(card: VMcpCard)}
	<DotDotDot
		placement="bottom-start"
		class="relative z-10 size-9 shrink-0"
		classes={{ menu: 'min-w-48' }}
		ariaLabel={`Actions for ${card.name}`}
	>
		{#snippet children({ toggle })}
			<a
				class="menu-button justify-between"
				href={resolve(`/audit-logs?mcp_id=${encodeURIComponent(card.id)}`)}
				target="_blank"
				rel="noopener"
				onclick={(e) => {
					e.stopPropagation();
					toggle(false);
				}}
			>
				View Audit Logs <ExternalLink class="size-4" />
			</a>
			<a
				class="menu-button justify-between"
				href={resolve(`/usage?mcp_id=${encodeURIComponent(card.id)}`)}
				target="_blank"
				rel="noopener"
				onclick={(e) => {
					e.stopPropagation();
					toggle(false);
				}}
			>
				View Usage <ExternalLink class="size-4" />
			</a>
			<button
				class="menu-button-destructive"
				onclick={(e) => {
					e.stopPropagation();
					onDelete?.(card.data);
					toggle(false);
				}}
			>
				<Trash2 class="size-4" />
				Delete
			</button>
		{/snippet}
	</DotDotDot>
{/snippet}
