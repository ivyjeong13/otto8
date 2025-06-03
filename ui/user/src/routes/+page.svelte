<script lang="ts">
	import { goto } from '$app/navigation';
	import { darkMode } from '$lib/stores';
	import { onMount } from 'svelte';
	import { type PageProps } from './$types';
	import { browser } from '$app/environment';
	import Logo from '$lib/components/navbar/Logo.svelte';
	import { getCurrentWindow, LogicalSize } from '@tauri-apps/api/window';

	let { data }: PageProps = $props();
	let { authProviders, loggedIn, editorProjects } = data;

	async function setWindowSize(loggedIn: boolean, onFinish?: () => void) {
		try {
			if (loggedIn) {
				await getCurrentWindow().setSize(new LogicalSize(1280, 800));
				await getCurrentWindow().setMinSize(new LogicalSize(1280, 800));
			} else {
				await getCurrentWindow().setSize(new LogicalSize(486, 700));
				await getCurrentWindow().setMinSize(new LogicalSize(485, 700));
			}
		} catch (e) {
			console.error(e);
		}

		onFinish?.();
	}

	onMount(async () => {
		setWindowSize(loggedIn);
	});

	$effect(() => {
		if (browser && loggedIn) {
			const lastVisitedObot = localStorage.getItem('lastVisitedObot');
			const matchingProject = editorProjects.find((p) => p.id === lastVisitedObot);
			const url = lastVisitedObot && matchingProject ? `/o/${matchingProject.id}` : '/projects';

			setWindowSize(loggedIn, () => {
				goto(url);
			});
		}
	});
</script>

<svelte:head>
	<title>Obot - Build Projects with MCP</title>
</svelte:head>

{#if !loggedIn}
	{@render unauthorizedContent()}
{:else}
	<div class="flex h-svh w-svw flex-col items-center justify-center">
		<div class="flex items-center justify-center">
			<div class="animate-bounce">
				<Logo />
			</div>
			<p class="text-base font-semibold">Logging in...</p>
		</div>
	</div>
{/if}

{#snippet unauthorizedContent()}
	<div class="flex h-screen w-screen items-center justify-center bg-gray-50 dark:bg-black">
		<div class="dark:bg-surface2 w-md rounded-xl bg-white p-4 py-12 shadow-sm">
			<div class="relative z-10 mb-6 flex w-full flex-col items-center justify-center gap-6">
				{#if darkMode.isDark}
					<img src="/user/images/obot-logo-blue-white-text.svg" class="h-12" alt="Obot logo" />
				{:else}
					<img src="/user/images/obot-logo-blue-black-text.svg" class="h-12" alt="Obot logo" />
				{/if}
				<p class="text-md px-8 text-center font-light text-gray-500 md:px-8 dark:text-gray-300">
					You're almost there! Sign in and you'll be on your way to collaborating and building your
					own projects.
				</p>
				<h3 class="dark:bg-surface2 bg-white px-2 text-lg font-semibold">
					Sign in to Your Account
				</h3>
			</div>

			<div
				class="border-surface3 relative -top-[18px] flex -translate-y-5 flex-col items-center gap-4 rounded-xl border-2 px-4 pt-6 pb-4"
			>
				{#each authProviders as provider}
					<a
						rel="external"
						href={browser && window.location.protocol === 'tauri:'
							? `http://localhost:8080/oauth2/start?obot-auth-provider=${provider.namespace}/${provider.id}`
							: `/oauth2/start?obot-auth-provider=${provider.namespace}/${provider.id}`}
						class="group bg-surface1 hover:bg-surface2 dark:bg-surface1 dark:hover:bg-surface3 flex w-full items-center justify-center gap-1.5 rounded-full p-2 px-8 text-lg font-semibold transition-colors duration-300"
						onclick={(e) => {
							console.log(`post-auth redirect ${e.target}`);
						}}
					>
						{#if provider.icon}
							<img
								class="h-6 w-6 rounded-full bg-transparent p-1 dark:bg-gray-600"
								src={provider.icon}
								alt={provider.name}
							/>
							<span class="text-center text-sm font-light">Continue with {provider.name}</span>
						{/if}
					</a>
				{/each}
				{#if authProviders.length === 0}
					<p>
						No auth providers configured. Please configure at least one auth provider in the admin
						panel.
					</p>
				{/if}
			</div>
		</div>
	</div>
{/snippet}
