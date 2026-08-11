import type { Snippet } from 'svelte';

export function isIconSnippet(value: unknown): value is Snippet {
	if (typeof value !== 'function') return false;
	// Dev: wrap_snippet replaces toString so snippets cannot be stringified.
	if (value.toString !== Function.prototype.toString) return true;
	// Prod: snippets are ($$anchor, ...params); components are ($$anchor, $$props).
	return value.length < 2;
}
