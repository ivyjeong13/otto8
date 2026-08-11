import IconSnippetHost from './IconSnippetHost.svelte';
import type { Component, ComponentProps, Snippet } from 'svelte';
import { render } from 'vitest-browser-svelte';

/**
 * Renders a component with a compiler `{#snippet icon()}` child.
 * Use when a prop can be a string, component, or snippet and the snippet-child path matters.
 */
export function renderWithIconSnippet<C extends Component<any>>(
	component: C,
	componentProps: Omit<ComponentProps<C>, 'icon'>,
	icon: Snippet
) {
	render(IconSnippetHost, {
		subject: component,
		subjectProps: componentProps,
		icon
	});
}
