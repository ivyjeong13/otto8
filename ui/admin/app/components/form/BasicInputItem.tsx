import { ReactNode } from "react";

import { cn } from "~/lib/utils";

import {
    FormControl,
    FormDescription,
    FormItem,
    FormLabel,
    FormMessage,
} from "~/components/ui/form";

export type BasicInputItemProps = {
    children: ReactNode;
    classNames?: {
        wrapper?: string;
        label?: string;
        description?: string;
        control?: string;
    };
    label?: ReactNode;
    description?: ReactNode;
    dynamicLabel?: boolean;
};

export function BasicInputItem({
    children,
    classNames = {},
    label,
    description,
    dynamicLabel = false,
}: BasicInputItemProps) {
    return (
        <FormItem className={cn(classNames.wrapper, "relative")}>
            {label && !dynamicLabel && (
                <FormLabel className={classNames.label}>{label}</FormLabel>
            )}

            <FormControl className={classNames.control}>{children}</FormControl>

            {label && dynamicLabel && (
                <FormLabel className={classNames.label}>{label}</FormLabel>
            )}

            <FormMessage />

            {description && (
                <FormDescription className={classNames.description}>
                    {description}
                </FormDescription>
            )}
        </FormItem>
    );
}
