<script lang="ts">
	import type { MCPCatalogEntry, MCPCatalogServer } from '$lib/services';
	import Select from '../Select.svelte';
	import CheckboxOption from './CheckboxOption.svelte';
	import { enterpriseCategories, enterpriseCategoryNames, flyIn, flyOut } from './constants';
	import { fly } from 'svelte/transition';
	import { twMerge } from 'tailwind-merge';

	interface Props {
		onContinue: () => void;
		onBack: () => void;
		boxClasses: string;
		selectedCategories: Record<string, boolean>;
		dataset: Record<string, (MCPCatalogServer | MCPCatalogEntry)[]>;
	}
	let {
		boxClasses,
		selectedCategories = $bindable(),
		dataset,
		onContinue,
		onBack
	}: Props = $props();

	let extraCategories = $state<string[]>([]);
	let extraCategoryQuery = $state('');
	const hasSelectedCategories = $derived(
		Object.keys(selectedCategories).filter((category) => selectedCategories[category]).length > 0
	);

	const initialVisibleCategories = 6;
	const sortedCategories = $derived(
		Object.entries(dataset)
			.filter(([category]) => !enterpriseCategoryNames.has(category.toLowerCase()))
			.sort(([, a], [, b]) => b.length - a.length)
			.map(([category]) => category)
	);
	const pinnedCategories = $derived(sortedCategories.slice(0, initialVisibleCategories));
	const pinnedCategorySet = $derived(
		new Set(pinnedCategories.map((category) => category.toLowerCase()))
	);
	const visibleCategories = $derived([
		...pinnedCategories,
		...extraCategories.filter((category) => !pinnedCategorySet.has(category.toLowerCase()))
	]);
	const extraCategorySet = $derived(
		new Set(extraCategories.map((category) => category.toLowerCase()))
	);
	const addableCategoryOptions = $derived(
		sortedCategories
			.filter(
				(category) =>
					!pinnedCategorySet.has(category.toLowerCase()) &&
					!extraCategorySet.has(category.toLowerCase())
			)
			.map((category) => ({ id: category, label: category }))
	);

	function handleSelectedCategoriesChange(id: string, checked: boolean) {
		selectedCategories[id] = checked;
	}

	function handleAddExtraCategory(category: string) {
		if (
			!category ||
			enterpriseCategoryNames.has(category.toLowerCase()) ||
			pinnedCategorySet.has(category.toLowerCase()) ||
			extraCategories.some((current) => current.toLowerCase() === category.toLowerCase())
		) {
			return;
		}
		extraCategories = [...extraCategories, category];
		selectedCategories[category] = true;
		extraCategoryQuery = '';
	}

	function handleRemoveExtraCategory(category: string) {
		extraCategories = extraCategories.filter((current) => current !== category);
		selectedCategories[category] = false;
	}
</script>

<div class={twMerge(boxClasses, 'w-3xl')} in:fly={flyIn} out:fly={flyOut}>
	<h2 class="text-center text-2xl font-semibold">MCP Servers Preferences</h2>

	<p class="text-center mb-2">Narrow down your selection of MCP servers based on your needs.</p>

	<div class="flex flex-col gap-6">
		<div class="divider my-0" id="enterprise-mcp-heading">
			<span class="text-sm">Enterprise MCP Servers</span>
		</div>
		<div class="flex flex-col gap-2">
			<div
				class="grid grid-cols-12 gap-2 @container"
				role="group"
				aria-labelledby="enterprise-mcp-heading"
			>
				{#each enterpriseCategories as category (category.id)}
					<CheckboxOption
						label={category.label}
						id={category.id}
						icon={category.iconURL}
						description={category.description}
						checked={selectedCategories[category.id]}
						onChange={handleSelectedCategoriesChange}
					/>
				{/each}
			</div>
		</div>

		<div class="divider my-0" id="mcp-category-heading">
			<span class="text-sm">By Category</span>
		</div>
		<div class="flex flex-col gap-2">
			{#if addableCategoryOptions.length > 0}
				{#key extraCategories.join(',')}
					<Select
						id="onboarding-add-category"
						classes={{ root: 'w-full' }}
						options={addableCategoryOptions}
						placeholder="Add a category..."
						searchPlaceholder="Search categories..."
						searchInDropdown
						bind:query={extraCategoryQuery}
						selected=""
						onSelect={(option) => {
							handleAddExtraCategory(String(option.id));
						}}
					/>
				{/key}
			{/if}
			<div class="flex flex-col gap-2 default-scrollbar-thin max-h-66 overflow-y-auto">
				<div
					class="grid grid-cols-12 gap-2 @container"
					role="group"
					aria-labelledby="mcp-category-heading"
				>
					{#each visibleCategories as category (category)}
						<CheckboxOption
							label={category}
							id={category}
							checked={selectedCategories[category]}
							onChange={handleSelectedCategoriesChange}
							onRemove={extraCategories.includes(category)
								? () => handleRemoveExtraCategory(category)
								: undefined}
						/>
					{/each}
				</div>
			</div>
		</div>

		<div class="flex w-full gap-2">
			<button type="button" class="btn btn-secondary flex-1" onclick={onBack}> Back </button>
			<button
				type="submit"
				class="btn btn-primary flex-1"
				onclick={onContinue}
				disabled={!hasSelectedCategories}
			>
				Continue
			</button>
		</div>
	</div>
</div>
