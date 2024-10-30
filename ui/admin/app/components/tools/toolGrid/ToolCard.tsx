import { Trash } from "lucide-react";

import { ToolReference } from "~/lib/model/toolReferences";
import { cn, timeSince } from "~/lib/utils";

import { TruncatedText } from "~/components/TruncatedText";
import {
    TypographyH4,
    TypographyP,
    TypographySmall,
} from "~/components/Typography";
import { ConfirmationDialog } from "~/components/composed/ConfirmationDialog";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
    Card,
    CardContent,
    CardFooter,
    CardHeader,
} from "~/components/ui/card";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "~/components/ui/tooltip";

import { ToolIcon } from "../ToolIcon";

interface ToolCardProps {
    tool: ToolReference;
    onDelete: (id: string) => void;
}

export function ToolCard({ tool, onDelete }: ToolCardProps) {
    return (
        <Card
            className={cn("flex flex-col h-full", {
                "border-2 border-info": tool.metadata?.bundle,
                "border-2 border-error": tool.error,
            })}
        >
            <CardHeader className="pb-2">
                <TypographyH4 className="truncate flex items-center">
                    <ToolIcon
                        className="w-5 h-5 mr-2"
                        name={tool.name}
                        icon={tool.metadata?.icon}
                    />
                    {tool.name}
                    {tool.error && (
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger>
                                    <Badge className="ml-2 bg-error mb-1 pointer-events-none">
                                        Failed
                                    </Badge>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs bg-error-foreground border border-error text-foreground">
                                    <TypographyP>{tool.error}</TypographyP>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    )}
                    {tool.metadata?.bundle && (
                        <Badge className="ml-2 bg-info pointer-events-none">
                            Bundle
                        </Badge>
                    )}
                </TypographyH4>
            </CardHeader>
            <CardContent className="flex-grow">
                <TruncatedText content={tool.reference} maxWidth="max-w-full" />
                <TypographyP className="mt-2 text-sm text-muted-foreground line-clamp-2">
                    {tool.description || "No description available"}
                </TypographyP>
            </CardContent>
            <CardFooter className="flex justify-between items-center pt-2 h-14">
                <TypographySmall className="text-muted-foreground">
                    {timeSince(new Date(tool.created))} ago
                </TypographySmall>
                {!tool.builtin && (
                    <ConfirmationDialog
                        title="Delete Tool Reference"
                        description="Are you sure you want to delete this tool reference? This action cannot be undone."
                        onConfirm={() => onDelete(tool.id)}
                        confirmProps={{
                            variant: "destructive",
                            children: "Delete",
                        }}
                    >
                        <Button
                            variant="ghost"
                            size="sm"
                            className="w-8 h-8 p-0"
                        >
                            <Trash className="text-muted-foreground w-5 h-5" />
                        </Button>
                    </ConfirmationDialog>
                )}
            </CardFooter>
        </Card>
    );
}
