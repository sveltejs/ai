import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import Component from './Component.svelte';
import { createRawSnippet } from 'svelte';

const children = createRawSnippet<[item: string]>((item)=>{
	return {
		render() {
			return `<div>${item()}</div>`
		},
		setup(element) {
			$effect.pre(()=>{
				element.textContent = item();
			})
		},
	}
})

describe('Search Filter', () => {
	it('filters items based on search query', async () => {
		const user = userEvent.setup();
		const items = [{ name: 'Apple' }, { name: 'Banana' }];

		render(Component, {
			props: { items, searchFields: ['name'], children }
		});

		const searchbox = screen.getByRole('searchbox');
		await user.type(searchbox, 'app');

		expect(screen.getByText('Apple')).toBeInTheDocument();
		expect(screen.queryByText('Banana')).not.toBeInTheDocument();
	});

	it('shows result count', async () => {
		const user = userEvent.setup();
		const items = [
			{ name: 'Apple' },
			{ name: 'Apricot' },
			{ name: 'Banana' }
		];

		render(Component, {
			props: { items, searchFields: ['name'], children }
		});

		const searchbox = screen.getByRole('searchbox');
		await user.type(searchbox, 'ap');

		expect(screen.getByText('2 results')).toBeInTheDocument();
	});

	it('is case insensitive', async () => {
		const user = userEvent.setup();
		const items = [{ name: 'Apple' }, { name: 'Banana' }];

		render(Component, {
			props: { items, searchFields: ['name'], children }
		});

		const searchbox = screen.getByRole('searchbox');
		await user.type(searchbox, 'APPLE');

		expect(screen.getByText('Apple')).toBeInTheDocument();
		expect(screen.getByText('1 results')).toBeInTheDocument();
	});

	it('searches multiple fields', async () => {
		const user = userEvent.setup();
		const items = [
			{ name: 'Apple', description: 'A red fruit' },
			{ name: 'Banana', description: 'A yellow fruit' }
		];

		render(Component, {
			props: { items, searchFields: ['name', 'description'], children }
		});

		const searchbox = screen.getByRole('searchbox');
		await user.type(searchbox, 'yellow');

		expect(screen.getByText('Banana')).toBeInTheDocument();
		expect(screen.queryByText('Apple')).not.toBeInTheDocument();
	});

	it('shows all items with empty query', async () => {
		const items = [
			{ name: 'Apple' },
			{ name: 'Banana' },
			{ name: 'Cherry' }
		];

		render(Component, {
			props: { items, searchFields: ['name'], children }
		});

		expect(screen.getByText('Apple')).toBeInTheDocument();
		expect(screen.getByText('Banana')).toBeInTheDocument();
		expect(screen.getByText('Cherry')).toBeInTheDocument();
		expect(screen.getByText('3 results')).toBeInTheDocument();
	});

	it('shows zero count for no results', async () => {
		const user = userEvent.setup();
		const items = [{ name: 'Apple' }, { name: 'Banana' }];

		render(Component, {
			props: { items, searchFields: ['name'], children }
		});

		const searchbox = screen.getByRole('searchbox');
		await user.type(searchbox, 'xyz');

		expect(screen.getByText('0 results')).toBeInTheDocument();
	});
});
