<script lang="ts">
	import { tooltip } from '$lib/actions/tooltip.svelte';
	import CopyButton from '$lib/components/CopyButton.svelte';
	import Layout from '$lib/components/Layout.svelte';
	import ResponsiveDialog from '$lib/components/ResponsiveDialog.svelte';
	import SensitiveInput from '$lib/components/SensitiveInput.svelte';
	import { PAGE_TRANSITION_DURATION } from '$lib/constants.js';
	import { AdminService } from '$lib/services';
	import { CircleAlert, Info } from 'lucide-svelte';
	import { untrack } from 'svelte';
	import { fade, slide } from 'svelte/transition';
	import { twMerge } from 'tailwind-merge';

	let { data } = $props();
	let license = $state(untrack(() => data.license));

	let updateLicenseDialog = $state<ReturnType<typeof ResponsiveDialog>>();
	let updateLicenseKey = $state('');
	let updating = $state(false);
	let updateError = $state('');

	function handleOpenUpdateLicenseDialog() {
		if (!license || license.locked) return;
		updateLicenseKey = '';
		updateError = '';
		updateLicenseDialog?.open();
	}

	async function handleUpdateLicense() {
		updating = true;
		updateError = '';
		try {
			await AdminService.updateLicense({ licenseKey: updateLicenseKey }, { dontLogErrors: true });
			updateLicenseDialog?.close();
			window.location.reload();
		} catch (err) {
			updateError = err instanceof Error ? err.message : 'An unknown error occurred.';
		} finally {
			updating = false;
		}
	}

	function convertUserFriendlyEntitlements(entitlements: string[]): string[] {
		return entitlements.map((entitlement) => {
			switch (entitlement) {
				case 'OBOT_ENTERPRISE_AUTH_PROVIDERS':
					return 'Auth Providers';
				case 'OBOT_ENTERPRISE_MODEL_PROVIDERS':
					return 'Model Providers';
				default:
					return entitlement;
			}
		});
	}

	const duration = PAGE_TRANSITION_DURATION;
</script>

<Layout title="License">
	<div class="h-full w-full" in:fade={{ duration }} out:fade={{ duration }}>
		<div class="flex flex-col gap-4">
			{#if license && !license.licenseKey}
				<div class="notification-info p-3 text-sm font-light">
					<div class="flex items-center gap-3">
						<Info class="size-6" />
						<div>
							Interested in purchasing a license or want to learn more? Contact support at <a
								href="mailto:licensing@obot.ai"
								class="text-link">licensing@obot.ai</a
							>.
						</div>
					</div>
				</div>
			{:else if license && license.locked}
				<div class="notification-alert p-3 text-sm font-light">
					<div class="flex items-center gap-3">
						<CircleAlert class="size-6" />
						<div>
							The license key has been <b class="font-semibold">suspended</b>. Please contact
							support at
							<a href="mailto:licensing@obot.ai" class="text-link">licensing@obot.ai</a> to renew your
							license.
						</div>
					</div>
				</div>
			{:else if license && !license.enterprise}
				<div class="notification-info p-3 text-sm font-light">
					<div class="flex items-center gap-3">
						<Info class="size-6" />
						<div>
							The license key was added via configuration and therefore <b class="font-semibold"
								>read-only</b
							>. It cannot be updated from the UI.
						</div>
					</div>
				</div>
			{/if}
			<div class="paper flex flex-col gap-6">
				{#if license}
					{#if license.licenseKey}
						<div class="flex flex-col gap-1">
							<div class="flex items-center gap-2">
								<label for="license-key" class="text-sm font-light">License Key</label>

								<CopyButton
									classes={{ button: 'flex items-center gap-1 text-xs text-primary' }}
									text={license.licenseKey}
								/>
							</div>
							<SensitiveInput name="license-key" value={license.licenseKey} disabled />
						</div>
					{/if}
					<div class="flex items-center justify-between gap-4">
						<div class="flex flex-col gap-1">
							<p class="text-sm font-light">License Status</p>
							<p
								class={twMerge(
									'text-sm',
									license.licenseKey && 'uppercase font-medium',
									license.licenseKey
										? license.enterprise
											? 'text-success'
											: 'text-error'
										: 'text-muted-content'
								)}
							>
								{#if license.licenseKey}
									{license.enterprise ? 'Active' : 'Suspended'}
								{:else}
									N/A <span class="text-xs font-light">(Open-Source)</span>
								{/if}
							</p>
						</div>
						{#if license.licenseKey}
							<div
								use:tooltip={{
									text: license.locked
										? 'The license key is locked and cannot be updated.'
										: undefined
								}}
							>
								<button
									class="btn btn-secondary"
									onclick={handleOpenUpdateLicenseDialog}
									disabled={license.locked}
								>
									Update License Key
								</button>
							</div>
						{/if}
					</div>
					<div class="flex flex-col gap-1">
						<p class="text-sm font-light">License Entitlements</p>
						{#if license.entitlements}
							<ul class="flex flex-wrap gap-2">
								{#each convertUserFriendlyEntitlements(license.entitlements ?? []) as entitlement (entitlement)}
									<li class="badge badge-soft badge-sm">{entitlement}</li>
								{/each}
							</ul>
						{:else}
							-
						{/if}
					</div>
				{/if}
			</div>
		</div>
	</div>
</Layout>

<ResponsiveDialog bind:this={updateLicenseDialog} title="Update License Key" class="max-w-md">
	<div class="flex flex-col gap-4">
		<p class="text-sm font-light">Enter the new license key to update.</p>
		<SensitiveInput name="license-key" bind:value={updateLicenseKey} />
		{#if updateError}
			<div in:slide={{ duration: 150, axis: 'y' }} class="alert alert-error alert-soft">
				{updateError}
			</div>
		{/if}
		<button class="btn btn-primary" disabled={updating} onclick={handleUpdateLicense}>
			Submit
		</button>
	</div>
</ResponsiveDialog>

<svelte:head>
	<title>Obot | License</title>
</svelte:head>
