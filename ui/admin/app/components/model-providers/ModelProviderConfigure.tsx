import { BoxesIcon, SettingsIcon } from "lucide-react";
import { useState } from "react";
import useSWR from "swr";

import { ModelProvider } from "~/lib/model/modelProviders";
import { ModelProviderService } from "~/lib/service/api/modelProviderApiService";

import { ModelProviderForm } from "~/components/model-providers/ModelProviderForm";
import { LoadingSpinner } from "~/components/ui/LoadingSpinner";
import { Button } from "~/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "~/components/ui/dialog";

type ModelProviderConfigureProps = {
    modelProvider: ModelProvider;
};

export function ModelProviderConfigure({
    modelProvider,
}: ModelProviderConfigureProps) {
    const [dialogIsOpen, setDialogIsOpen] = useState(false);
    const handleOpenChange = (open: boolean) => {
        if (!open) {
            setDialogIsOpen(false);
        }
    };

    return (
        <Dialog open={dialogIsOpen} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                <Button
                    size="icon"
                    variant="ghost"
                    className="mt-0"
                    onClick={() => setDialogIsOpen(true)}
                >
                    <SettingsIcon />
                </Button>
            </DialogTrigger>

            <DialogDescription hidden>
                Configure Model Provider
            </DialogDescription>

            <DialogContent>
                <ModelProviderConfigureContent
                    modelProvider={modelProvider}
                    onSuccess={() => setDialogIsOpen(false)}
                />
            </DialogContent>
        </Dialog>
    );
}

export function ModelProviderConfigureContent({
    modelProvider,
    onSuccess,
}: {
    modelProvider: ModelProvider;
    onSuccess: () => void;
}) {
    const revealModelProvider = useSWR(
        ModelProviderService.revealModelProviderById.key(modelProvider.id),
        ({ modelProviderId }) =>
            ModelProviderService.revealModelProviderById(modelProviderId)
    );

    const requiredParameters = modelProvider.requiredConfigurationParameters;
    const parameters = revealModelProvider.data;

    return revealModelProvider.isLoading ? (
        <LoadingSpinner />
    ) : (
        <>
            <DialogHeader>
                <DialogTitle className="mb-4 flex items-center gap-2">
                    <BoxesIcon />{" "}
                    {modelProvider.configured
                        ? `Configure ${modelProvider.name}`
                        : `Set Up ${modelProvider.name}`}
                </DialogTitle>
                <ModelProviderForm
                    modelProviderId={modelProvider.id}
                    onSuccess={() => {
                        console.log("B");
                        onSuccess();
                    }}
                    parameters={parameters ?? {}}
                    requiredParameters={requiredParameters ?? []}
                />
            </DialogHeader>
        </>
    );
}
