import { DEFAULT_MCP_CATALOG_ID } from '$lib/constants';
import { handleRouteError } from '$lib/errors';
import { AdminService } from '$lib/services';
import type { PageLoad } from './$types';
import { redirect } from '@sveltejs/kit';

export const load: PageLoad = async ({ parent, params, fetch }) => {
	const { profile } = await parent();
	if (!profile.isAdmin?.()) {
		throw redirect(307, '/');
	}

	let catalogEntry;
	try {
		catalogEntry = await AdminService.getMCPCatalogEntry(DEFAULT_MCP_CATALOG_ID, params.id, {
			fetch
		});
	} catch (err) {
		handleRouteError(err, `/vmcps/${params.id}`, profile);
	}

	if (catalogEntry.manifest.runtime !== 'composite') {
		throw redirect(307, '/vmcps');
	}

	return { catalogEntry };
};
