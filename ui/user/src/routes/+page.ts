import { BOOTSTRAP_USER_ID } from '$lib/constants';
import { UserService, type AuthProvider, type BootstrapStatus, Group } from '$lib/services';
import type { PageLoad } from './$types';
import { redirect } from '@sveltejs/kit';

export const load: PageLoad = async ({ fetch, url, parent }) => {
	const { profile } = await parent();
	const loggedIn = profile?.loaded ?? false;

	let bootstrapStatus: BootstrapStatus | undefined;
	let authProviders: AuthProvider[] = [];
	if (!loggedIn) {
		[bootstrapStatus, authProviders] = await Promise.all([
			UserService.getBootstrapStatus(),
			UserService.listAuthProviders({ fetch })
		]);
	}
	const isAdminOrOwner =
		profile?.groups.includes(Group.ADMIN) || profile?.groups.includes(Group.OWNER);
	const isBootstrapUser = profile?.username === BOOTSTRAP_USER_ID;

	if (loggedIn) {
		if (isBootstrapUser) {
			throw redirect(307, '/admin/auth-providers');
		}

		const redirectRoute = url.searchParams.get('rd');
		if (redirectRoute && !profile.onboarded) {
			throw redirect(302, redirectRoute);
		}

		if (profile.onboarded) {
			const defaultRoute = isAdminOrOwner ? '/admin/dashboard' : '/mcp-servers';
			throw redirect(302, defaultRoute);
		}
	}

	if (bootstrapStatus?.enabled && authProviders.length === 0) {
		// If no auth providers are available, redirect to the admin page for bootstrap login.
		throw redirect(302, '/admin');
	}

	return {
		loggedIn,
		onboarded: profile.onboarded,
		authProviders
	};
};
