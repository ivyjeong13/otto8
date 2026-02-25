import { ChatAPI } from '$lib/services/nanobot/chat/index.svelte';
import { nanobotChat } from '$lib/stores/nanobotChat.svelte';
import { get } from 'svelte/store';

export async function initializeNanobot(
	initializeConnectUrl: string,
	projectId: string,
	threadId?: string
): Promise<void> {
	const storedChat = get(nanobotChat);

	if (!storedChat) {
		console.log('loading initial layout');
		const api = new ChatAPI(initializeConnectUrl, {
			sessionId: getStoredRootSessionId(initializeConnectUrl),
			onInitialized: (sessionId) => {
				localStorage.setItem(`mcp-session-base-url:${initializeConnectUrl}`, sessionId);
			}
		});
		nanobotChat.set({
			api,
			status: {
				threads: 'loading',
				workflows: 'loading',
				files: 'loading'
			},
			projectId,
			threadId,
			threads: [],
			workflows: [],
			files: []
		});
	}

	loadThreads();
	loadWorkflows();
	loadFiles();
}

function getStoredRootSessionId(baseUrl: string): string | undefined {
	if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
		return undefined;
	}
	const stored = localStorage.getItem(`mcp-session-base-url:${baseUrl}`);
	if (!stored) {
		return undefined;
	}
	return stored;
}

export function loadThreads() {
	nanobotChat.update((data) => {
		if (data) {
			data.status.threads = 'loading';
		}
		return data;
	});
	get(nanobotChat)
		?.api.getThreads()
		.then((threads) => {
			nanobotChat.update((data) => {
				if (data) {
					data.threads = threads ?? [];
					data.status.threads = 'loaded';
				}
				return data;
			});
		})
		.catch((err) => {
			console.error('error loading threads', err);
			nanobotChat.update((data) => {
				if (data) {
					data.status.threads = 'error';
				}
				return data;
			});
		});
}

export function loadWorkflows() {
	nanobotChat.update((data) => {
		if (data) {
			data.status.workflows = 'loading';
		}
		return data;
	});
	get(nanobotChat)
		?.api.getWorkflows()
		.then((workflows) => {
			nanobotChat.update((data) => {
				if (data) {
					data.workflows = workflows ?? [];
					data.status.workflows = 'loaded';
				}
				return data;
			});
		})
		.catch((err) => {
			console.error('error loading workflows', err);
			nanobotChat.update((data) => {
				if (data) {
					data.status.workflows = 'error';
				}
				return data;
			});
		});
}

export function loadFiles() {
	nanobotChat.update((data) => {
		if (data) {
			data.status.files = 'loading';
		}
		return data;
	});
	get(nanobotChat)
		?.api.getFiles()
		.then((files) => {
			nanobotChat.update((data) => {
				if (data) {
					data.files = files ?? [];
					data.status.files = 'loaded';
				}
				return data;
			});
		})
		.catch((err) => {
			console.error('error loading files', err);
			nanobotChat.update((data) => {
				if (data) {
					data.status.files = 'error';
				}
				return data;
			});
		});
}
