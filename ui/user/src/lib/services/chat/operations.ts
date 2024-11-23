import { baseURL, doDelete, doGet, doPost, doPut } from './http';
import {
	type AssistantToolList,
	type Assistants,
	type CredentialList,
	type Files,
	type KnowledgeFile,
	type KnowledgeFiles,
	type Profile,
	type Task,
	type TaskList,
	type TaskRun,
	type TaskRunList,
	type Version
} from './types';

export async function getProfile(): Promise<Profile> {
	const obj = (await doGet('/me')) as Profile;
	obj.isAdmin = () => {
		return obj.role === 1;
	};
	obj.loaded = true;
	return obj;
}

export async function getVersion(): Promise<Version> {
	return (await doGet('/version')) as Version;
}

export async function listAssistants(): Promise<Assistants> {
	const assistants = (await doGet(`/assistants`)) as Assistants;
	if (!assistants.items) {
		assistants.items = [];
	}
	return assistants;
}

export async function deleteKnowledgeFile(assistant: string, filename: string) {
	return doDelete(`/assistants/${assistant}/knowledge/${filename}`);
}

export async function deleteFile(assistant: string, filename: string) {
	return doDelete(`/assistants/${assistant}/files/${filename}`);
}

export async function getFile(assistant: string, filename: string): Promise<string> {
	return (await doGet(`/assistants/${assistant}/file/${filename}`, {
		text: true
	})) as string;
}

export async function uploadKnowledge(assistant: string, file: File): Promise<KnowledgeFile> {
	return (await doPost(`/assistants/${assistant}/knowledge/${file.name}`, file)) as KnowledgeFile;
}

interface DeletedItems<T extends Deleted> {
	items: T[];
}

interface Deleted {
	deleted?: string;
}

function removedDeleted<V extends Deleted, T extends DeletedItems<V>>(items: T): T {
	items.items = items.items?.filter((item) => !item.deleted);
	return items;
}

export async function listKnowledgeFiles(assistant: string): Promise<KnowledgeFiles> {
	const files = (await doGet(`/assistants/${assistant}/knowledge`)) as KnowledgeFiles;
	if (!files.items) {
		files.items = [];
	}
	return removedDeleted(files);
}

export async function listFiles(assistant: string): Promise<Files> {
	const files = (await doGet(`/assistants/${assistant}/files`)) as Files;
	if (!files.items) {
		files.items = [];
	}
	return files;
}

export async function invoke(assistant: string, msg: string | object) {
	await doPost(`/assistants/${assistant}/invoke`, msg);
}

export async function abort(assistant: string) {
	await doPost(`/assistants/${assistant}/abort`, {});
}

export async function listCredentials(assistant: string): Promise<CredentialList> {
	const list = (await doGet(`/assistants/${assistant}/credentials`)) as CredentialList;
	if (!list.items) {
		list.items = [];
	}
	return list;
}

export async function deleteCredential(assistant: string, id: string) {
	return doDelete(`/assistants/${assistant}/credentials/${id}`);
}

export async function listTools(assistant: string): Promise<AssistantToolList> {
	const list = (await doGet(`/assistants/${assistant}/tools`)) as AssistantToolList;
	if (!list.items) {
		list.items = [];
	}
	return list;
}

export async function enableTool(assistant: string, tool: string): Promise<AssistantToolList> {
	return (await doPut(`/assistants/${assistant}/tools/${tool}`)) as AssistantToolList;
}

export async function disableTool(assistant: string, tool: string): Promise<AssistantToolList> {
	return (await doDelete(`/assistants/${assistant}/tools/${tool}`)) as AssistantToolList;
}

export async function saveTask(assistant: string, task: Task): Promise<Task> {
	return (await doPut(`/assistants/${assistant}/tasks/${task.id}`, task)) as Task;
}

export async function runTask(
	assistant: string,
	taskID: string,
	opts?: {
		stepID?: string;
		input?: string | object;
	}
): Promise<TaskRun> {
	const url = `/assistants/${assistant}/tasks/${taskID}/run?step=${opts?.stepID ?? ''}`;
	return (await doPost(url, opts?.input ?? {})) as TaskRun;
}

export function newMessageEventSource(
	assistant: string,
	opts?: {
		task?: {
			id: string;
			follow?: boolean;
		};
	}
): EventSource {
	if (opts?.task) {
		return new EventSource(
			baseURL +
				`/assistants/${assistant}/tasks/${opts.task.id}/events${opts.task.follow ? '?follow=true' : ''}`
		);
	}
	return new EventSource(baseURL + `/assistants/${assistant}/events`);
}

export async function listTasks(assistant: string): Promise<TaskList> {
	const list = (await doGet(`/assistants/${assistant}/tasks`)) as TaskList;
	if (!list.items) {
		list.items = [];
	}
	return list;
}

export async function createTask(assistant: string, task?: Task): Promise<Task> {
	return (await doPost(
		`/assistants/${assistant}/tasks`,
		task ?? {
			steps: []
		}
	)) as Task;
}

export async function deleteTask(assistant: string, id: string) {
	return doDelete(`/assistants/${assistant}/tasks/${id}`);
}

export async function getTask(assistant: string, id: string): Promise<Task> {
	return (await doGet(`/assistants/${assistant}/tasks/${id}`)) as Task;
}

export async function deleteTaskRun(assistant: string, id: string, runID: string) {
	return doDelete(`/assistants/${assistant}/tasks/${id}/runs/${runID}`);
}

export async function listTaskRuns(assistant: string, id: string): Promise<TaskRunList> {
	const list = (await doGet(`/assistants/${assistant}/tasks/${id}/runs`)) as TaskRunList;
	if (!list.items) {
		list.items = [];
	}
	return list;
}
