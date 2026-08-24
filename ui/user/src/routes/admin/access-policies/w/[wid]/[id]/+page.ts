import { handleRouteError } from '$lib/errors';
import { UserService } from '$lib/services';
import { profile } from '$lib/stores';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch, params }) => {
	try {
		return {
			accessPolicy: await UserService.getWorkspaceAccessPolicy(params.wid, params.id, { fetch }),
			workspaceID: params.wid
		};
	} catch (error) {
		handleRouteError(error, `/admin/access-policies/w/${params.wid}/${params.id}`, profile.current);
	}
};
