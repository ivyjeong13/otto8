<script lang="ts">
	import AppNotificationBanner from '$lib/components/AppNotificationBanner.svelte';
	import InfoTooltip from '$lib/components/InfoTooltip.svelte';
	import Layout from '$lib/components/Layout.svelte';
	import Select from '$lib/components/Select.svelte';
	import { PAGE_TRANSITION_DURATION } from '$lib/constants';
	import { AdminService, type AppNotifications, type BannerType } from '$lib/services';
	import { profile } from '$lib/stores';
	import { success } from '$lib/stores/success';
	import { untrack } from 'svelte';
	import { fade } from 'svelte/transition';
	import { twMerge } from 'tailwind-merge';

	let { data } = $props();
	let appNotifications = $state(untrack(() => data.appNotifications));

	const duration = PAGE_TRANSITION_DURATION;
	let saving = $state(false);
	let showRequiredFieldsError = $state(false);
	let isAdminReadonly = $derived(profile.current.isAdminReadonly?.());

	function validate(banner: AppNotifications['banner']) {
		return banner.enabled ? banner.text?.trim().length > 0 && banner.type : true;
	}

	async function handleSave() {
		if (!validate(appNotifications.banner)) {
			showRequiredFieldsError = true;
			return;
		}

		showRequiredFieldsError = false;
		saving = true;
		try {
			await AdminService.updateAppNotifications(appNotifications);
			success.add('App notifications updated successfully.');
		} catch (_err) {
			// will get logged by handleRouteError
		} finally {
			saving = false;
		}
	}
</script>

<Layout title="App Notifications" classes={{ container: 'pb-0' }}>
	<div class="relative h-full w-full @container flex flex-col gap-4" transition:fade={{ duration }}>
		<div class="paper gap-0.5">
			<label for="enable-banner" class="w-full flex items-start justify-between gap-4">
				<div class="text-sm">
					<p>Enable Banner</p>
					<p class="text-xs font-light text-muted-content mb-2">
						Enabling the banner will display it at the top of the page across all pages (except
						agents, if enabled).
					</p>
				</div>
				<input
					type="checkbox"
					class="toggle toggle-sm"
					bind:checked={appNotifications.banner.enabled}
					id="enable-banner"
					disabled={isAdminReadonly}
					onclick={() => {
						showRequiredFieldsError = false;
					}}
				/>
			</label>

			<div class="divider mt-0"></div>

			<div class={appNotifications.banner.enabled ? '' : 'opacity-50 pointer-events-none'}>
				<p class="text-sm font-medium mb-2">Banner Preview</p>

				<div class="w-full mb-4">
					<AppNotificationBanner
						data={appNotifications.banner}
						placeholder="[insert text to display here]"
					/>
				</div>

				<div class="divider mt-0"></div>

				<div class="flex flex-col gap-4">
					<div class="flex items-center gap-4">
						<label for="banner-type-selector" class="text-sm font-light">Type</label>
						<div class="w-full">
							<Select
								id="banner-type-selector"
								class="bg-base-200 dark:bg-base-100 dark:border-base-400 flex-1 border border-transparent shadow-none"
								selected={appNotifications.banner.type}
								onSelect={(selected) => {
									appNotifications.banner.type = selected.id as BannerType;
								}}
								disabled={isAdminReadonly}
								options={[
									{ id: 'info', label: 'Info' },
									{ id: 'warning', label: 'Warning' }
								]}
							/>
						</div>
					</div>

					<div class="flex flex-col gap-2">
						<p
							class={twMerge(
								'text-sm font-light inline-flex items-center gap-1',
								showRequiredFieldsError && 'text-error'
							)}
						>
							Text <InfoTooltip text="Supports Markdown syntax." />
						</p>
						<textarea
							class={twMerge(
								'input-text-filled min-h-[120px] resize-y',
								showRequiredFieldsError && 'error'
							)}
							bind:value={appNotifications.banner.text}
							disabled={isAdminReadonly}
						></textarea>
						{#if showRequiredFieldsError}
							<p class="text-xs font-light text-error">This field is required.</p>
						{/if}
					</div>
					<label for="dismiss-banner-toggle" class="flex items-center justify-between">
						<div>
							<p class="text-sm font-light">Dismissable</p>
							<p class="text-xs font-light text-muted-content mb-2">
								The banner is {appNotifications.banner.dismissable
									? 'dismissable'
									: 'not dismissable'}. {appNotifications.banner.dismissable
									? 'The user can dismiss the banner and it will not appear again for their device.'
									: 'The banner will stay visible and cannot be hidden by the user.'}
							</p>
						</div>
						<input
							id="dismiss-banner-toggle"
							type="checkbox"
							class="toggle toggle-sm"
							bind:checked={appNotifications.banner.dismissable}
							disabled={isAdminReadonly}
						/>
					</label>
				</div>
			</div>
		</div>
		<div class="flex grow"></div>
		{#if !isAdminReadonly}
			<div
				class="bg-base-200 text-muted-content dark:bg-base-100 sticky bottom-0 left-0 z-50 flex w-full justify-end gap-2 py-4"
			>
				<div class="flex w-full justify-end gap-2">
					<button
						class="btn btn-secondary text-sm"
						onclick={() => {
							appNotifications.banner.enabled = false;
						}}
						disabled={saving}
					>
						Cancel
					</button>
					<button class="btn btn-primary text-sm" disabled={saving} onclick={handleSave}>
						Save
					</button>
				</div>
			</div>
		{/if}
	</div></Layout
>

<svelte:head>
	<title>Obot | App Notifications</title>
</svelte:head>
