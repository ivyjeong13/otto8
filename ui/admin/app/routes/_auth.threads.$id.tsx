import { ArrowLeftIcon } from "lucide-react";
import {
	ClientLoaderFunctionArgs,
	MetaFunction,
	redirect,
	useLoaderData,
	useMatch,
	useNavigate,
} from "react-router";
import { $path } from "safe-routes";

import { KnowledgeFileNamespace } from "~/lib/model/knowledge";
import { AgentService } from "~/lib/service/api/agentService";
import { KnowledgeFileService } from "~/lib/service/api/knowledgeFileApiService";
import { ThreadsService } from "~/lib/service/api/threadsService";
import { WorkflowService } from "~/lib/service/api/workflowService";
import { RouteHandle } from "~/lib/service/routeHandles";
import { RouteService } from "~/lib/service/routeService";
import { noop } from "~/lib/utils";

import { Chat } from "~/components/chat";
import { ChatProvider } from "~/components/chat/ChatContext";
import { ThreadMeta } from "~/components/thread/ThreadMeta";
import { Button } from "~/components/ui/button";
import {
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
} from "~/components/ui/resizable";
import { ScrollArea } from "~/components/ui/scroll-area";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "~/components/ui/tooltip";

export const clientLoader = async ({
	params,
	request,
}: ClientLoaderFunctionArgs) => {
	const routeInfo = RouteService.getRouteInfo(
		"/threads/:id",
		new URL(request.url),
		params
	);

	const { id } = routeInfo.pathParams;

	if (!id) {
		throw redirect("/threads");
	}

	const thread = await ThreadsService.getThreadById(id);
	if (!thread) throw redirect("/threads");

	const agent = thread.agentID
		? await AgentService.getAgentById(thread.agentID).catch(noop)
		: null;

	const workflow = thread.workflowID
		? await WorkflowService.getWorkflowById(thread.workflowID).catch(noop)
		: null;

	const files = await ThreadsService.getFiles(id);
	const knowledge = await KnowledgeFileService.getKnowledgeFiles(
		KnowledgeFileNamespace.Threads,
		thread.id
	);

	return { thread, agent, workflow, files, knowledge };
};

export default function ChatAgent() {
	const { thread, agent, workflow, files, knowledge } =
		useLoaderData<typeof clientLoader>();

	const getEntity = () => {
		if (agent) return agent;
		if (workflow) return workflow;
		throw new Error("Trying to view a thread with an unsupported parent.");
	};

	const entity = getEntity();

	const navigate = useNavigate();
	return (
		<div className="relative flex h-full flex-col overflow-hidden">
			<Tooltip>
				<TooltipTrigger asChild>
					<Button
						variant="outline"
						size="icon"
						className="absolute left-4 top-4 z-10"
						asChild
					>
						<Button size="icon" variant="outline" onClick={() => navigate(-1)}>
							<ArrowLeftIcon className="h-4 w-4" />
						</Button>
					</Button>
				</TooltipTrigger>
				<TooltipContent>Go Back</TooltipContent>
			</Tooltip>

			<ResizablePanelGroup direction="horizontal" className="flex-auto">
				<ResizablePanel defaultSize={70} minSize={25}>
					<ChatProvider id={entity.id} mode="agent" threadId={thread.id}>
						<Chat />
					</ChatProvider>
				</ResizablePanel>
				<ResizableHandle />
				<ResizablePanel defaultSize={30} minSize={25}>
					<ScrollArea className="h-full">
						<ThreadMeta
							className="rounded-none border-none"
							thread={thread}
							for={entity}
							files={files}
							knowledge={knowledge}
						/>
					</ScrollArea>
				</ResizablePanel>
			</ResizablePanelGroup>
		</div>
	);
}

const ThreadBreadcrumb = () => useMatch("/threads/:id")?.params.id;

export const handle: RouteHandle = {
	breadcrumb: () => [
		{ content: "Threads", href: $path("/threads") },
		{ content: <ThreadBreadcrumb /> },
	],
};

export const meta: MetaFunction<typeof clientLoader> = ({ data }) => {
	return [{ title: `Thread • ${data?.thread.id}` }];
};
