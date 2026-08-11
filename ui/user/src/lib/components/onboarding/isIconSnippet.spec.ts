import { isIconSnippet } from './isIconSnippet';
import { createRawSnippet } from 'svelte';
import { describe, expect, it } from 'vitest';

describe('isIconSnippet', () => {
	it('rejects strings and missing values', () => {
		expect(isIconSnippet('/icon.png')).toBe(false);
		expect(isIconSnippet(undefined)).toBe(false);
	});

	it('accepts createRawSnippet results', () => {
		const snippet = createRawSnippet(() => ({ render: () => '<span></span>' }));
		expect(isIconSnippet(snippet)).toBe(true);
	});

	it('accepts functions whose toString was replaced, like dev snippets', () => {
		const snippet = () => {};
		snippet.toString = () => '';
		expect(isIconSnippet(snippet)).toBe(true);
	});

	it('rejects two-argument component functions', () => {
		function Component(_anchor: unknown, _props: unknown) {}
		expect(isIconSnippet(Component)).toBe(false);
	});
});
