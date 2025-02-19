import editor from '$lib/stores/editor.svelte';
import type { CitationSource, Explain, InputMessage, Message, Messages, Progress } from './types';

const errorIcon = 'Error';
const assistantIcon = 'Assistant';
const profileIcon = 'Profile';

function toMessageFromInput(s: string): string {
	try {
		const input = JSON.parse(s) as InputMessage;
		if (input.type === 'assistant-prompt') {
			return input.prompt;
		}
	} catch {
		// ignore error
	}
	return s;
}

function setFileContent(name: string, content: string, full: boolean = false) {
	const existing = editor.items.find((f) => f.id === name);
	if (existing) {
		if (full) {
			existing.contents = content;
		} else if (content.length < existing.contents.length) {
			existing.contents = content + existing.contents.slice(content.length);
		} else {
			existing.contents = content;
		}
	} else {
		editor.items.push({
			id: name,
			name: name,
			contents: content,
			buffer: ''
		});
	}

	// select the file
	editor.items.forEach((f) => {
		f.selected = f.name === name;
	});
}

function reformatInputMessage(msg: Message) {
	try {
		const input = JSON.parse(msg.message.join('')) as {
			prompt?: string;
			explain?: Explain;
			improve?: Explain;
		};
		if (input.prompt) {
			if (input.improve) {
				msg.message = ['Improve: ', ...input.prompt];
			} else {
				msg.message = [input.prompt];
			}
		} else if (input.prompt === '') {
			msg.message = [''];
		}
		if (input.explain) {
			msg.explain = input.explain;
			msg.message = ['Explain'];
		} else if (input.improve) {
			msg.explain = input.improve;
		}
	} catch {
		// ignore error
	}
}

function getFilenameAndContent(content: string) {
	let testContent = content;
	while (testContent) {
		try {
			if (!testContent.endsWith('"}')) {
				return JSON.parse(testContent + '"}');
			}
			return JSON.parse(testContent);
		} catch {
			testContent = testContent.slice(0, -1);
		}
	}
	return {
		filename: '',
		content: ''
	};
}

function reformatWriteMessage(msg: Message, last: boolean) {
	msg.icon = 'Pencil';
	msg.done = !last || msg.toolCall !== undefined;
	msg.sourceName = msg.done ? 'Wrote to Workspace' : 'Writing to Workspace';
	let content = msg.message.join('').trim();
	if (!content.endsWith('"}')) {
		content += '"}';
	}
	try {
		const obj = getFilenameAndContent(content);
		if (obj.filename) {
			msg.file = {
				filename: obj.filename,
				content: ''
			};
			msg.file.filename = obj.filename;
			if (obj.content) {
				msg.file.content = obj.content;
			}
		}
		msg.message = [];
	} catch {
		// ignore error
	}

	if (last && msg.file?.filename && msg.file?.content) {
		setFileContent(msg.file.filename, msg.file.content, msg.toolCall !== undefined);
	}
}

export function buildMessagesFromProgress(progresses: Progress[]): Messages {
	const messages = toMessages(progresses);

	// Post Process for much more better-ness
	messages.messages.forEach((item, i) => {
		if (item.tool && item.sourceName == 'workspace_write') {
			reformatWriteMessage(item, i == messages.messages.length - 1);
			return;
		} else if (item.sent) {
			reformatInputMessage(item);
		}

		if (item.toolInput) {
			item.message = ['Preparing information...'];
		} else if (item.toolCall) {
			item.message = ['Calling...'];
		}

		// For all but last message
		if (i < messages.messages.length - 1) {
			if (item.oauthURL || item.promptId) {
				item.ignore = true;
			}
			if (item.tool) {
				item.done = true;
				item.message = [];
			}
		}
	});

	return messages;
}

function toMessages(progresses: Progress[]): Messages {
	let messages: Message[] = [];
	let lastRunID: string | undefined;
	let parentRunID: string | undefined;
	let inProgress = false;

	let sources: CitationSource[] = [];

	for (const [i, progress] of progresses.entries()) {
		if (progress.error) {
			if (progress.runID) {
				for (const message of messages) {
					if (message.runID === progress.runID) {
						message.aborted = true;
					}
				}
			}
		}

		if (progress.runID) {
			lastRunID = progress.runID;
			inProgress = true;
		} else {
			// if it doesn't have a runID we don't know what do to with it, so ignore
			continue;
		}

		if (progress.parentRunID) {
			if (progress.runID === lastRunID) {
				parentRunID = progress.parentRunID;
			} else {
				parentRunID = undefined;
			}
		}

		if (progress.runComplete) {
			lastRunID = progress.runID;
			inProgress = false;
			for (const message of messages) {
				if (message.runID === progress.runID) {
					message.done = true;
				}
			}
		} else {
			inProgress = true;
		}

		if (progress.error) {
			messages.push(newErrorMessage(progress));
		} else if (progress.waitingOnModel) {
			if (i === progresses.length - 1) {
				// Only add if it's the last one
				messages.push(newWaitingOnModelMessage(progress));
			}
		} else if (progress.prompt) {
			if (progress.prompt.metadata?.authType === 'oauth') {
				messages.push(newOAuthMessage(progress));
			}
			if (progress.prompt.fields) {
				messages.push(newPromptAuthMessage(progress));
			}
		} else if (progress.input) {
			// delete the current runID, this is to avoid duplicate messages
			messages = messages.filter((m) => m.runID !== progress.runID);
			messages.push(newInputMessage(progress, parentRunID));
		} else if (progress.content) {
			const found = messages.findLast(
				(m) => m.contentID === progress.contentID && progress.contentID
			);
			if (found) {
				found.message.push(progress.content);
				found.time = new Date(progress.time);
			} else {
				messages.push(newContentMessage(progress, sources.length ? sources : undefined));
				sources = [];
			}
		} else if (progress.toolInput) {
			const found = messages.findLast(
				(m) => m.contentID === progress.contentID && progress.contentID
			);
			if (found) {
				if (progress.toolInput.input) {
					found.message.push(progress.toolInput.input);
				}
			} else {
				messages.push(newContentMessage(progress));
			}
		} else if (progress.toolCall) {
			// once we see a toolCall ignore all previous toolInputs or toolCall
			for (const msg of messages) {
				if (msg.runID === progress.runID && (msg.toolInput || msg.toolCall)) {
					msg.ignore = true;
				}
			}

			messages.push(newContentMessage(progress));

			if (!progress.toolCall.output) continue;

			try {
				const output = JSON.parse(progress.toolCall.output);

				switch (true) {
					case progress.toolCall.name === 'Knowledge':
						sources.push(...(output as CitationSource[]));
						break;
					case progress.toolCall.name === 'Search' &&
						progress.toolCall.metadata?.toolBundle === 'Tavily Search':
						sources.push(...(output.results as CitationSource[]));
						break;
					case progress.toolCall.name === 'Search' &&
						progress.toolCall.metadata?.toolBundle === 'Google Search':
						sources.push(...(output.results as CitationSource[]));
						break;
				}
			} catch (_) {
				// ignore error
			}
		}
	}

	return {
		lastRunID,
		messages,
		inProgress
	};
}

function newInputMessage(progress: Progress, parentRunID?: string): Message {
	return {
		runID: progress.runID || '',
		parentRunID: parentRunID,
		time: new Date(progress.time),
		icon: profileIcon,
		sourceName: 'You',
		sent: true,
		message: [toMessageFromInput(progress.input || '')],
		done: true
	};
}

function newOAuthMessage(progress: Progress): Message {
	// prompt will not be undefined at this point
	return {
		runID: progress.runID || '',
		time: new Date(progress.time),
		icon: progress.prompt?.metadata?.icon || assistantIcon,
		sourceName: progress.prompt?.name || 'Assistant',
		sourceDescription: progress.prompt?.description,
		oauthURL: progress.prompt?.metadata?.authURL || '',
		message: progress.prompt?.message ? [progress.prompt?.message] : []
	};
}

function newPromptAuthMessage(progress: Progress): Message {
	return {
		runID: progress.runID || '',
		time: new Date(progress.time),
		icon: progress.prompt?.metadata?.icon || assistantIcon,
		sourceName: progress.prompt?.name || 'Assistant',
		sourceDescription: progress.prompt?.description,
		message: progress.prompt?.message ? [progress.prompt?.message] : [],
		fields: progress.prompt?.fields,
		promptId: progress.prompt?.id
	};
}

function newWaitingOnModelMessage(progress: Progress): Message {
	return {
		runID: progress.runID || '',
		time: new Date(progress.time),
		icon: assistantIcon,
		sourceName: 'Assistant',
		message: ['Thinking really hard...']
	};
}

function newErrorMessage(progress: Progress): Message {
	return {
		time: new Date(progress.time),
		runID: progress.runID || '',
		icon: errorIcon,
		sourceName: 'Assistant',
		message: [progress.error ?? 'Error']
	};
}

function newContentMessage(progress: Progress, citations?: CitationSource[]): Message {
	const result: Message = {
		time: new Date(progress.time),
		runID: progress.runID || '',
		icon: assistantIcon,
		sourceName: 'Assistant',
		message: [progress.toolInput?.input ?? progress.content],
		contentID: progress.contentID,
		citations
	};

	if (progress.toolInput) {
		if (progress.toolInput.name) {
			result.sourceName = progress.toolInput.name;
		}
		result.sourceDescription = progress.toolInput.description;
		if (progress.toolInput.metadata?.icon) {
			result.icon = progress.toolInput.metadata.icon;
		}
		result.message = progress.toolInput.input ? [progress.toolInput.input] : [];
		result.toolInput = true;
		result.tool = true;
	}

	if (progress.toolCall) {
		if (progress.toolCall.name) {
			result.sourceName = progress.toolCall.name;
		}
		result.sourceDescription = progress.toolCall.description;
		if (progress.toolCall.metadata?.icon) {
			result.icon = progress.toolCall.metadata.icon;
		}
		result.message = progress.toolCall.input ? [progress.toolCall.input] : [];
		result.toolCall = progress.toolCall;
		result.tool = true;
	}

	return result;
}
