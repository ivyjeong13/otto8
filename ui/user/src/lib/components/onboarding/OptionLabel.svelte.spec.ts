import { renderWithIconSnippet } from '../../../tests/helpers/iconSnippet';
import OptionLabel from './OptionLabel.svelte';
import { Server } from '@lucide/svelte';
import { createRawSnippet } from 'svelte';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';

describe('OptionLabel.svelte', () => {
	it('renders a URL icon as an image', async () => {
		render(OptionLabel, {
			label: 'Windows',
			descriptionId: 'option-label-desc',
			icon: '/icon.png'
		});

		await expect.element(page.getByText('Windows')).toBeVisible();
		await expect.element(page.getByCSS('img.icon')).toBeInTheDocument();
	});

	it('renders a Svelte component icon', async () => {
		render(OptionLabel, {
			label: 'Server',
			descriptionId: 'option-label-desc',
			icon: Server
		});

		await expect.element(page.getByText('Server')).toBeVisible();
		await expect.element(page.getByCSS('img.icon')).not.toBeInTheDocument();
	});

	it('renders a createRawSnippet icon', async () => {
		const icon = createRawSnippet(() => ({
			render: () => '<span>raw-icon</span>'
		}));

		render(OptionLabel, {
			label: 'Linux',
			descriptionId: 'option-label-desc',
			icon
		});

		await expect.element(page.getByText('raw-icon')).toBeVisible();
		await expect.element(page.getByText('Linux')).toBeVisible();
	});

	it('renders a {#snippet icon()} child without mounting it as a component', async () => {
		renderWithIconSnippet(
			OptionLabel,
			{ label: 'macOS', descriptionId: 'option-label-desc' },
			createRawSnippet(() => ({
				render: () => '<span>os-icon</span>'
			}))
		);

		await expect.element(page.getByText('os-icon')).toBeVisible();
		await expect.element(page.getByText('macOS')).toBeVisible();
	});
});
