<script lang="ts">
	import { FileTextIcon } from 'lucide-svelte';
	import type { Snippet } from 'svelte';
	import { twMerge } from 'tailwind-merge';

	interface Props {
		acceptedFileTypes?: string[];
		class?: string;
		children: Snippet;
		onFilesDrop?: (files: File[]) => void;
		onFileDragEnter?: () => void;
		onFileDragLeave?: () => void;
		placeholder?: string;
	}

	let {
		acceptedFileTypes,
		class: classNames,
		children,
		onFilesDrop,
		onFileDragEnter,
		onFileDragLeave,
		placeholder = 'Drop file here.'
	}: Props = $props();

	let dragOver = $state(false);
	let dragCounter = 0;

	function handleDragEnter(e: DragEvent) {
		e.preventDefault();
		e.stopPropagation();
		dragCounter++;
		dragOver = true;
		onFileDragEnter?.();
	}

	function handleDragLeave(e: DragEvent) {
		e.preventDefault();
		e.stopPropagation();
		dragCounter--;
		if (dragCounter === 0) {
			dragOver = false;
			onFileDragLeave?.();
		}
	}

	function handleDragOver(e: DragEvent) {
		e.preventDefault();
		e.stopPropagation();
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		e.stopPropagation();
		dragOver = false;

		const files = e.dataTransfer?.files;
		if (files) {
			const validFiles = acceptedFileTypes
				? Array.from(files).filter((file) =>
						acceptedFileTypes.some((type) => file.name.toLowerCase().endsWith(type.toLowerCase()))
					)
				: Array.from(files);
			if (validFiles.length > 0) {
				onFilesDrop?.(validFiles);
			}
		}
	}
</script>

<div
	class={twMerge(
		classNames,
		'rounded-md border-2 border-dashed transition-all duration-300 ease-in-out',
		dragOver && 'border-blue-500 bg-blue-500/10',
		!dragOver && 'border-transparent'
	)}
	role="region"
	ondragenter={handleDragEnter}
	ondragleave={handleDragLeave}
	ondragover={handleDragOver}
	ondrop={handleDrop}
>
	{@render children()}

	<div
		class={twMerge(
			'absolute left-1/2 top-1/2 flex h-32 w-full max-w-[700px] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center gap-2 transition-all duration-300 ease-in-out',
			dragOver && 'opacity-100',
			!dragOver && 'opacity-0'
		)}
	>
		<FileTextIcon class="h-12 w-12 text-blue-500" />
		<p class="text-blue-500">{placeholder}</p>
	</div>
</div>
