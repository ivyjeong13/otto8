import { ChatService } from '$lib/services';
import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params, fetch }) => {
	try {
		const project = await ChatService.getProject(params.project, { fetch });
		const tools = await ChatService.listTools(project.assistantID, project.id, { fetch });
		return {
			project,
			tools: tools.items
		};
	} catch (e) {
		if (!(e instanceof Error)) {
			throw new Error('Unknown error occurred');
		}
		const status = e.message?.includes('404') || e.message?.includes("not found") ? 404 : 500;
		throw error(status, e.message);
	}
};
