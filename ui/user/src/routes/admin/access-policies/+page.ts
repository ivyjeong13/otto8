import { handleRouteError } from '$lib/errors';
import { AdminService, type AccessPolicy } from '$lib/services';
import { profile } from '$lib/stores';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch }) => {
	let accessPolicies: AccessPolicy[] = [];
	try {
		const [globalPolicies, workspacePolicies] = await Promise.all([
			AdminService.listAccessPolicies({ fetch }),
			AdminService.listAllWorkspaceAccessPolicies({ fetch })
		]);
		accessPolicies = [...globalPolicies, ...workspacePolicies];
	} catch (error) {
		handleRouteError(error, '/admin/access-policies', profile.current);
	}
	return { accessPolicies };
};
