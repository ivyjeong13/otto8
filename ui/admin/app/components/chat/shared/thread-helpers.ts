import { toast } from "sonner";
import useSWR from "swr";

import { CredentialNamespace } from "~/lib/model/credentials";
import { KnowledgeFileNamespace } from "~/lib/model/knowledge";
import { UpdateThread } from "~/lib/model/threads";
import { AgentService } from "~/lib/service/api/agentService";
import { CredentialApiService } from "~/lib/service/api/credentialApiService";
import { KnowledgeFileService } from "~/lib/service/api/knowledgeFileApiService";
import { ThreadsService } from "~/lib/service/api/threadsService";
import { PaginationParams } from "~/lib/service/queryService";

import { useAsync } from "~/hooks/useAsync";

function useThread(id?: Nullish<string>) {
	return useSWR(...ThreadsService.getThreadById.swr({ id }));
}

export function useOptimisticThread(threadId?: Nullish<string>) {
	const { data: thread, mutate } = useThread(threadId);

	const handleUpdateThread = useAsync(ThreadsService.updateThreadById);

	const updateThread = async (updates: Partial<UpdateThread>) => {
		if (!thread) return;

		const updatedThread = { ...thread, ...updates };

		// optimistic update
		mutate((thread) => (thread ? updatedThread : thread), false);

		const [error, data] = await handleUpdateThread.executeAsync(
			thread.id,
			updatedThread
		);

		if (data) return;

		if (error instanceof Error) toast.error(error.message);

		// revert optimistic update
		mutate(thread);
	};

	return { thread, updateThread };
}

export function useThreadKnowledge(threadId?: Nullish<string>) {
	return useSWR(
		KnowledgeFileService.getKnowledgeFiles.key(
			KnowledgeFileNamespace.Threads,
			threadId
		),
		({ entityId, namespace }) =>
			KnowledgeFileService.getKnowledgeFiles(namespace, entityId)
	);
}

export function useThreadFiles(
	threadId?: Nullish<string>,
	pagination?: PaginationParams,
	search?: string
) {
	const { data, ...rest } = useSWR(
		...ThreadsService.getFiles.swr({
			threadId,
			query: { pagination },
			filters: { search },
		})
	);

	return { data, ...rest };
}

export function useThreadAgents(threadId?: Nullish<string>) {
	const { data: thread } = useThread(threadId);

	return useSWR(
		...AgentService.getAgentById.swr({ agentId: thread?.assistantID })
	);
}

export function useThreadCredentials(threadId: Nullish<string>) {
	const getCredentials = useSWR(
		...CredentialApiService.getCredentials.swr({
			namespace: CredentialNamespace.Threads,
			entityId: threadId,
		})
	);

	const handleDeleteCredential = async (credentialName: string) => {
		if (!threadId) return;

		return await CredentialApiService.deleteCredential(
			CredentialNamespace.Threads,
			threadId,
			credentialName
		);
	};

	const deleteCredential = useAsync(handleDeleteCredential, {
		onSuccess: (credentialId) => {
			getCredentials.mutate((creds) =>
				creds?.filter((c) => c.name !== credentialId)
			);
		},
	});

	return { getCredentials, deleteCredential };
}

export const useThreadTasks = (agentThreadId?: string) => {
	const { data: tasks, ...rest } = useSWR(
		...ThreadsService.getTasksForThread.swr({ threadId: agentThreadId })
	);

	const getThreads = useSWR(
		...ThreadsService.getThreads.swr({}, { enabled: !!agentThreadId })
	);

	const runCounts = getThreads.data?.reduce<Record<string, number>>(
		(acc, thread) => {
			if (!thread.taskID) return acc;

			acc[thread.taskID] = (acc[thread.taskID] || 0) + 1;
			return acc;
		},
		{}
	);

	return {
		tasks:
			tasks?.map((task) => ({
				...task,
				runCount: runCounts?.[task.id] ?? 0,
			})) ?? [],
		...rest,
	};
};
