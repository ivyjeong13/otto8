<script lang="ts">
	import { browser } from '$app/environment';
	import Logo from '$lib/components/Logo.svelte';
	import SensitiveInput from '$lib/components/SensitiveInput.svelte';
	import { LOCAL_AUTH_MIN_PASSWORD_LENGTH } from '$lib/constants';
	import { CircleAlert } from '@lucide/svelte';

	// The form posts to the auth provider, which sets the session cookie and redirects to `rd`.
	// On failure it redirects back here with an `error` message to show.
	let params = $derived(browser ? new URL(window.location.href).searchParams : undefined);
	let rd = $derived(params?.get('rd') ?? '/');
	let error = $derived(params?.get('error'));
	let showRequestAccessDialog = $state(false);
	let requestAccessSent = $state(false);
	let submittingRequestAccess = $state(false);

	// Stub: /api/request-access is not implemented yet. Always show confirmation either way.
	async function handleRequestAccess(event: SubmitEvent) {
		event.preventDefault();
		if (submittingRequestAccess) return;

		const form = event.currentTarget;
		if (!(form instanceof HTMLFormElement)) return;

		submittingRequestAccess = true;
		try {
			await fetch('/api/request-access', {
				method: 'POST',
				body: new FormData(form)
			});
		} catch {
			// ignore — confirmation is shown regardless of success/error
		} finally {
			requestAccessSent = true;
			submittingRequestAccess = false;
		}
	}
</script>

<svelte:head>
	<title>Obot | Sign In</title>
</svelte:head>

<div
	class="text-base-content dark:from-base-300 to-base-200 flex h-dvh w-full flex-col items-center justify-center bg-radial-[at_50%_50%] from-gray-50 dark:to-black"
>
	{#if showRequestAccessDialog}
		<div
			class="dark:border-base-400 dark:bg-base-200 bg-base-100 flex w-sm flex-col gap-4 rounded-xl border border-transparent p-6 shadow-sm"
		>
			<Logo class="h-12 self-center" />

			{#if requestAccessSent}
				<h1 class="text-center text-xl font-semibold">Your request has been sent</h1>
				<p class="text-muted-content text-center text-sm font-light">
					We'll follow up once your access request has been reviewed.
				</p>
				<button
					type="button"
					class="btn btn-primary w-full"
					onclick={() => {
						showRequestAccessDialog = false;
						requestAccessSent = false;
					}}
				>
					Back to sign in
				</button>
			{:else}
				<form class="flex flex-col gap-4" onsubmit={handleRequestAccess}>
					<h1 class="text-center text-xl font-semibold">Request Access</h1>

					<label class="flex flex-col gap-1 text-sm font-light" for="request-access-email">
						Email
						<input
							id="request-access-email"
							class="text-input-filled"
							type="email"
							name="email"
							autocomplete="username"
							required
						/>
					</label>

					<button class="btn btn-primary w-full" type="submit" disabled={submittingRequestAccess}>
						Submit
					</button>
				</form>
			{/if}
		</div>
	{:else}
		<form
			method="POST"
			action="/oauth2/start"
			class="dark:border-base-400 dark:bg-base-200 bg-base-100 flex w-sm flex-col gap-4 rounded-xl border border-transparent p-6 shadow-sm"
		>
			<Logo class="h-12 self-center" />
			<h1 class="text-center text-xl font-semibold">Sign in to Obot</h1>

			{#if error}
				<div class="notification-error flex items-center gap-2">
					<CircleAlert class="text-error size-5 shrink-0" />
					<p class="text-sm font-light">{error}</p>
				</div>
			{/if}

			<input type="hidden" name="rd" value={rd} />

			<label class="flex flex-col gap-1 text-sm font-light" for="local-auth-email">
				Email
				<input
					id="local-auth-email"
					class="text-input-filled"
					type="email"
					name="email"
					autocomplete="username"
					required
				/>
			</label>

			<label class="flex flex-col gap-1 text-sm font-light" for="password">
				Password
				<SensitiveInput
					name="password"
					class="text-input-filled"
					autocomplete="current-password"
					minlength={LOCAL_AUTH_MIN_PASSWORD_LENGTH}
					required
					data1pIgnore={false}
				/>
			</label>

			<button class="btn btn-primary w-full" type="submit">Sign in</button>

			<p class="text-muted-content text-center text-xs font-light">
				Don't have an account? <button
					type="button"
					class="btn btn-link text-xs p-0"
					onclick={() => {
						showRequestAccessDialog = true;
					}}
				>
					Request access.
				</button>
			</p>
		</form>
	{/if}
</div>
