import { ChatService, type KnowledgeFile } from '$lib/services';

const store = $state({
	addUploadingFile,
	uploadingFiles: [] as { name: string; file: File }[],
	knowledgeFiles: [] as KnowledgeFile[],
	refresh
});

async function refresh(assistantId: string, projectId: string, currentThreadId?: string) {
	const response = await ChatService.listKnowledgeFiles(assistantId, projectId, {
		threadID: currentThreadId
	});
	store.knowledgeFiles = response.items;
}

async function addUploadingFile(
	file: File,
	assistantId: string,
	projectId: string,
	callback?: () => void
) {
	store.uploadingFiles.push({ name: file.name, file });
	return ChatService.uploadKnowledge(assistantId, projectId, file)
		.then(() => {
			callback?.();
		})
		.catch((error) => {
			console.error(error);
		})
		.finally(() => {
			store.uploadingFiles = store.uploadingFiles.filter((f) => f.name !== file.name);
			setTimeout(() => {
				refresh(assistantId, projectId);
			}, 1000);
		});
}

export default store;
