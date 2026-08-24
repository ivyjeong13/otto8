import { handleRouteError } from '$lib/errors';
import { AdminService } from '$lib/services';
import { profile } from '$lib/stores';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch, params }) => {
	try {
		return { accessPolicy: await AdminService.getAccessPolicy(params.id, { fetch }) };
	} catch (error) {
		handleRouteError(error, `/admin/access-policies/${params.id}`, profile.current);
	}
};
