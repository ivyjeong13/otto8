import type { ChatService } from '$lib/services/nanobot/chat/index.svelte';
import type { ChatAPI } from '$lib/services/nanobot/chat/index.svelte';
import type { Chat, Resource } from '$lib/services/nanobot/types';
import { writable } from 'svelte/store';

export type LoadingStatus = 'loading' | 'loaded' | 'error';

export interface NanobotChat {
	api: ChatAPI;
	projectId: string;
	threadId?: string;
	chat?: ChatService;
	threads: Chat[];
	status: {
		threads: LoadingStatus;
		workflows: LoadingStatus;
		files: LoadingStatus;
	};
	workflows: Resource[];
	files: Resource[];
}

/**
 * Storing nanobot chat data in a store so it can be accessed from anywhere in the app.
 */
export const nanobotChat = writable<NanobotChat | null>(null);
