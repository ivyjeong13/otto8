<script lang="ts">
	import { AdminService, type AuthProvider } from '$lib/services';
	import { darkMode, version } from '$lib/stores';
	import { adminConfigStore } from '$lib/stores/adminConfig.svelte';
	import { success } from '$lib/stores/success';
	import ResponsiveDialog from '../ResponsiveDialog.svelte';
	import AuthDeconfigureConfirm from './AuthDeconfigureConfirm.svelte';
	import { Mail, ShieldAlert } from 'lucide-svelte';
	import { slide } from 'svelte/transition';

	let licenseViolationDialog = $state<ReturnType<typeof ResponsiveDialog>>();
	let confirmDowngradeDialog = $state<ReturnType<typeof AuthDeconfigureConfirm>>();
	let authProviderToDeconfigure = $state<AuthProvider | undefined>();

	let downgrading = $state(false);
	let error = $state('');

	async function handleDowngrade() {
		downgrading = true;
		if (!version.current.licenseEntitlementViolations) {
			console.error('No license entitlement violations found');
			return;
		}

		try {
			for (const provider of version.current.licenseEntitlementViolations) {
				if (provider.type === 'authProvider') {
					await AdminService.deconfigureAuthProvider(provider.name);
				} else if (provider.type === 'modelProvider') {
					await AdminService.deconfigureModelProvider(provider.name);
				}
			}

			const modelProviders = await AdminService.listModelProviders();
			const authProviders = await AdminService.listAuthProviders();
			adminConfigStore.updateAuthProviders(authProviders);
			adminConfigStore.updateModelProviders(modelProviders);

			confirmDowngradeDialog?.close();
			success.add('Downgrade operation completed successfully.');
		} catch (err) {
			error = err instanceof Error ? err.message : 'An unknown error occurred.';
		} finally {
			downgrading = false;
		}
	}
</script>

{#if version.current.licenseEntitlementViolations}
	<div class="bg-base-100">
		<div class="bg-warning/10 text-warning px-4 py-2 flex justify-between md:justify-center gap-2">
			<div class="flex items-center gap-4 md:gap-0.5 justify-center">
				<ShieldAlert class="text-warning size-4 shrink-0" />
				<p class="text-xs text-semibold">
					Your license is <b class="font-semibold uppercase">suspended</b>. For full functionality,
					it is recommended to resolve the outstanding issues.
				</p>
			</div>
			<button class="btn btn-xs btn-warning" onclick={() => licenseViolationDialog?.open()}>
				Resolve
			</button>
		</div>
	</div>
{/if}

<ResponsiveDialog bind:this={licenseViolationDialog} title="Suspended License" class="md:max-w-md">
	<div class="md:p-0 p-4">
		<div class="flex flex-col gap-4">
			<p class="font-light">
				To re-enable full access to existing functionality, please contact support at
				<a href="mailto:licensing@obot.ai" class="text-link">licensing@obot.ai</a> to renew your license.
			</p>
			<a href="mailto:licensing@obot.ai" class="btn btn-primary">
				<Mail class="size-4" />
				Contact Support
			</a>
		</div>
		<div class="divider">OR</div>
		<div class="flex flex-col gap-4">
			{#each version.current.licenseEntitlementViolations as violation (violation.name)}
				{@const provider =
					violation.type === 'authProvider'
						? $adminConfigStore.authProviders.find((p) => p.id === violation.name)
						: $adminConfigStore.modelProviders.find((p) => p.id === violation.name)}
				{#if provider}
					<div class="flex justify-between gap-4">
						<div class="dark:bg-base-400 p-1 rounded-md shrink-0">
							{#if darkMode.isDark}
								{@const url = provider.iconDark || provider.icon}
								<img src={url} alt={provider.name} class="size-10 rounded-md p-1" />
							{:else}
								<img
									src={provider.icon}
									alt={provider.name}
									class="size-10 rounded-md p-1 dark:bg-base-400"
								/>
							{/if}
						</div>
						<div class="flex grow flex-col gap-0.5">
							<p class="font-semibold">Deconfigure {provider.name}</p>
							<p class="text-xs text-muted-content">
								{#if violation.type === 'authProvider'}
									Users logged in via {provider.name} will need to sign in via a different accessible
									provider.
								{:else}
									Deconfiguring this model provider will cause loss of access to the models provided
									by
									{provider.name}.
								{/if}
							</p>
						</div>
					</div>
				{/if}
			{/each}
			{#if error}
				<div
					role="alert"
					class="alert alert-error alert-soft"
					in:slide={{ duration: 150, axis: 'y' }}
				>
					{error}
				</div>
			{/if}
			<button
				class="btn btn-error btn-soft mt-2"
				onclick={() => {
					licenseViolationDialog?.close();
					const authProviderName = version.current.licenseEntitlementViolations?.find(
						(violation) => violation.type === 'authProvider'
					)?.name;
					const authProvider = $adminConfigStore.authProviders.find(
						(p) => p.id === authProviderName
					);
					if (authProvider) {
						authProviderToDeconfigure = authProvider;
					}
					confirmDowngradeDialog?.open();
				}}
			>
				Downgrade
			</button>
		</div>
	</div>
</ResponsiveDialog>

<AuthDeconfigureConfirm
	bind:this={confirmDowngradeDialog}
	onConfirm={handleDowngrade}
	onCancel={() => licenseViolationDialog?.open()}
	loading={downgrading}
	provider={authProviderToDeconfigure}
	title="Confirm Downgrade"
	confirmButtonText="Downgrade"
/>
