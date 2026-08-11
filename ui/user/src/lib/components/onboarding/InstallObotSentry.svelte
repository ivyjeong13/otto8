<script lang="ts">
	import { saveBlob } from '$lib/download';
	import Loading from '$lib/icons/Loading.svelte';
	import { AdminService } from '$lib/services';
	import type { MDMConfiguration, MDMAssetSource, MDMAsset, MDMEnrollmentKey } from '$lib/services';
	import {
		getPlatformGroups,
		getTargetOptions,
		parseInstallerCommands
	} from '$lib/services/devices';
	import CopyField from '../CopyField.svelte';
	import RadioOption from './RadioOption.svelte';
	import { flyIn, flyOut } from './constants';
	import { Download, Terminal, TriangleAlert } from '@lucide/svelte';
	import { onMount } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import { twMerge } from 'tailwind-merge';

	interface Props {
		boxClasses: string;
		onBack: () => void;
		onDone: () => void;
		step: number;
	}
	// 0 = preference, 1 = install
	let { boxClasses, onBack, onDone, step = $bindable() }: Props = $props();
	let loading = $state(true);
	let generating = $state(false);

	let configuration = $state<MDMConfiguration>();
	let enrollmentKeys = $state<MDMEnrollmentKey[]>([]);
	let revealedCredential = $state('');
	let assetSource = $state<MDMAssetSource>();
	let assets = $state<MDMAsset[]>([]);
	let selectedPlatform = $state<string>('manual');
	let selectedOs = $state('');
	let enforcementEnabled = $state(false); // todo: default when enforce enabled true?
	let downloadLoading = $state(false);

	let latestAsset = $derived(assets.find((asset) => asset.digest === assetSource?.latestDigest));
	let targetOptions = $derived(getTargetOptions(latestAsset, configuration));
	let platformGroups = $derived(getPlatformGroups(targetOptions));
	let selectedTargetOptions = $derived(
		platformGroups.find((group) => group.platform === selectedPlatform)?.targets ?? []
	);
	let selectedArtifact = $derived(
		(configuration?.artifacts ?? []).find(
			(artifact) => artifact.platform === selectedPlatform && artifact.os === selectedOs
		)
	);
	let installerCommands = $derived(
		parseInstallerCommands(selectedArtifact?.instructions).map((command) =>
			revealedCredential
				? command.replaceAll('REPLACE_WITH_ENROLLMENT_KEY', revealedCredential)
				: command
		)
	);

	let unsubscribeFromUserReturn = () => {};
	function subscribeToUserReturn(handler: () => void) {
		document.addEventListener('visibilitychange', handler);
		window.addEventListener('focus', handler);
		return () => {
			document.removeEventListener('visibilitychange', handler);
			window.removeEventListener('focus', handler);
		};
	}

	function handleRefreshStats() {
		if (document.visibilityState !== 'visible') return;

		const start = new Date(Date.now() - 10 * 60 * 1000).toISOString();
		const end = new Date().toISOString();
		AdminService.getDeviceScanStats({ start, end }).then((response) => {
			if (response.deviceCount > 0) {
				onDone();
			}
		});
	}

	$effect(() => {
		if (step !== 1) return;

		unsubscribeFromUserReturn = subscribeToUserReturn(handleRefreshStats);
		return () => {
			unsubscribeFromUserReturn();
		};
	});

	onMount(() => {
		Promise.allSettled([
			AdminService.listMDMConfigurations({ fetch }),
			AdminService.getMDMAssetSource({ fetch }),
			AdminService.listMDMAssets({ fetch })
		]).then(async ([configurationResults, sourceResult, assetsResult]) => {
			if (configurationResults.status === 'fulfilled') {
				configuration =
					configurationResults.value.find((candidate) => candidate.isDefault) ??
					configurationResults.value[0];
			}
			if (!configuration) {
				configuration = await AdminService.createMDMConfiguration({ enforcementEnabled });
			}
			if (sourceResult.status === 'fulfilled') {
				assetSource = sourceResult.value;
			}
			if (assetsResult.status === 'fulfilled') {
				assets = assetsResult.value;
			}

			if (configuration) {
				enrollmentKeys = await AdminService.listMDMEnrollmentKeys(configuration.id);
			}

			loading = false;
		});
	});

	async function createEnrollmentKey() {
		if (!configuration) return;
		generating = true;
		// not reactive date, for calculating only
		// eslint-disable-next-line svelte/prefer-svelte-reactivity
		const now = new Date();
		const oneYearFromNow = new Date(now.setFullYear(now.getFullYear() + 1));

		const response = await AdminService.createMDMEnrollmentKey(configuration.id, {
			name: undefined,
			expiresAt: oneYearFromNow?.toISOString()
		});
		revealedCredential = response.enrollmentCredential;
		generating = false;
		step = 1;
	}

	async function handleDownload() {
		const artifact = selectedArtifact;
		if (!artifact || !configuration) return;
		downloadLoading = true;
		try {
			const { blob, filename } = await AdminService.downloadMDMConfig(
				configuration.id,
				artifact.slug
			);
			saveBlob(blob, filename);
		} finally {
			downloadLoading = false;
		}
	}
</script>

{#if loading}
	<Loading />
{:else if step === 0}
	{@render preference()}
{:else if step === 1}
	{@render install()}
{/if}

{#snippet preference()}
	<div class={twMerge(boxClasses, 'w-lg @container')} in:fly={flyIn} out:fly={flyOut}>
		<h2 class="text-center text-2xl font-semibold">What is Obot Sentry?</h2>
		<p>
			In order to discover shadow AI and enforce policies for unmanaged MCP servers, you will need
			to install Obot Sentry on your devices.
		</p>
		<p>
			We support other installation methods, such as Intune and Jamf, but to quickly see Obot Sentry
			in action, let's install it manually. You can uninstall and reinstall with your preferred
			method later on.
		</p>

		<h3 class="font-semibold text-center">Select OS Platform</h3>
		<div class="flex flex-col gap-2">
			{#each selectedTargetOptions as targetOption (targetOption.index)}
				<RadioOption
					label={targetOption.option.osLabel}
					id={targetOption.option.os}
					checked={selectedOs === targetOption.option.os}
					onChange={(os) => {
						selectedOs = os;
					}}
				>
					{#snippet icon()}
						{#if targetOption.option.os === 'windows'}
							<div class="devicon devicon-windows11-original text-[#0078D7]"></div>
						{:else if targetOption.option.os === 'macos'}
							<div class="devicon devicon-apple-original text-base-content"></div>
						{/if}
					{/snippet}
				</RadioOption>
			{/each}
		</div>

		<div class="flex flex-col gap-2 w-full @lg:flex-row">
			<button class="btn btn-secondary @lg:flex-1" onclick={onBack}> Back </button>
			<button
				class="btn btn-primary @lg:flex-1"
				onclick={async () => {
					if (enrollmentKeys.length === 0) {
						await createEnrollmentKey();
					} else {
						step = 1;
					}
				}}
				disabled={!selectedOs || generating}
			>
				{#if generating}
					<Loading />
				{:else if enrollmentKeys.length === 0}
					Generate Enrollment Key
				{:else}
					Continue
				{/if}
			</button>
		</div>
	</div>
{/snippet}

{#snippet install()}
	<div class={twMerge(boxClasses, 'w-2xl')} in:fly={flyIn} out:fly={flyOut}>
		<h2 class="text-center text-2xl font-semibold">Install Obot Sentry</h2>

		<h3 class="font-semibold">Your Enrollment Key:</h3>
		{#if revealedCredential}
			<div in:fade class="flex flex-col gap-2 mb-4">
				<CopyField value={revealedCredential} id="onboarding-enrollment-key" />
				<div class="notification-alert">
					<div class="flex items-start gap-3">
						<TriangleAlert class="size-5 shrink-0" />
						<div class="flex flex-col gap-1">
							<p class="text-sm font-medium">Save this key now</p>
							<p class="text-xs">
								This is the only time the enrollment key is shown. Distribute it through your MDM
								configuration; if you lose it, revoke this key and create a new one.
							</p>
						</div>
					</div>
				</div>
			</div>
		{:else if enrollmentKeys.length > 0}
			<div class="notification-info">
				<div class="flex items-start gap-3">
					<TriangleAlert class="size-5 shrink-0" />
					<div class="flex flex-col gap-1">
						<p class="text-sm font-medium">Existing Enrollment Key</p>
						<p class="text-xs">
							Looks like there is already an existing enrollment key. You can utilize it to install
							Obot Sentry. It is recommended to utilize the existing key and generate a new one only
							if necessary. Otherwise, you can generate a new enrollment key below.
						</p>
					</div>
				</div>
			</div>
			<button class="btn btn-primary mb-4" onclick={createEnrollmentKey}>
				{#if generating}
					<Loading />
				{:else}
					Generate New Enrollment Key
				{/if}
			</button>
		{/if}

		{#if selectedArtifact}
			<div class="divider text-xs uppercase my-0">
				Install obot-sentry-{selectedArtifact.slug}.zip
			</div>
			<button
				type="button"
				class="btn btn-primary"
				disabled={downloadLoading}
				onclick={handleDownload}
			>
				{#if downloadLoading}
					<Loading class="size-4" />
				{:else}
					<Download class="size-4" />
				{/if}
				Download File
			</button>

			<div class="divider text-xs uppercase mb-0">Run commands</div>
			{#if installerCommands.length}
				<div class="flex flex-col gap-2">
					{#each installerCommands as command, index (index)}
						<CopyField
							value={command}
							id="onboarding-install-command-{index}"
							classes={{ input: 'bg-base-200' }}
							variant="code"
						>
							{#snippet preContent()}
								<Terminal class="size-4" />
							{/snippet}
						</CopyField>
					{/each}
				</div>
			{/if}
		{/if}

		<p class="text-muted-content text-xs italic text-center animate-pulse">
			Waiting for initial device scan...
		</p>
	</div>
{/snippet}
