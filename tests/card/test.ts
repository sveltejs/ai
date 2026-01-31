import { render, screen } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import Card from './Component.svelte';
import { createRawSnippet } from 'svelte';

// Helper to create text snippets
function createTextSnippet(text: string) {
	return createRawSnippet(() => ({
		render() {
			return `<span>${text}</span>`;
		}
	}));
}

describe('Card with Slots', () => {
	it('renders body content', () => {
		const children = createTextSnippet('Body content');
		
		render(Card, {
			props: { children }
		});

		expect(screen.getByTestId('card-body')).toBeInTheDocument();
		expect(screen.getByText('Body content')).toBeInTheDocument();
	});

	it('renders header when provided', () => {
		const children = createTextSnippet('Body content');
		const header = createTextSnippet('Header content');
		
		render(Card, {
			props: { children, header }
		});

		expect(screen.getByTestId('card-header')).toBeInTheDocument();
		expect(screen.getByText('Header content')).toBeInTheDocument();
	});

	it('renders footer when provided', () => {
		const children = createTextSnippet('Body content');
		const footer = createTextSnippet('Footer content');
		
		render(Card, {
			props: { children, footer }
		});

		expect(screen.getByTestId('card-footer')).toBeInTheDocument();
		expect(screen.getByText('Footer content')).toBeInTheDocument();
	});

	it('header not rendered when empty', () => {
		const children = createTextSnippet('Body content');
		
		render(Card, {
			props: { children }
		});

		expect(screen.queryByTestId('card-header')).not.toBeInTheDocument();
	});

	it('footer not rendered when empty', () => {
		const children = createTextSnippet('Body content');
		
		render(Card, {
			props: { children }
		});

		expect(screen.queryByTestId('card-footer')).not.toBeInTheDocument();
	});

	it('applies variant class - outlined', () => {
		const children = createTextSnippet('Body content');
		
		render(Card, {
			props: { children, variant: 'outlined' }
		});

		const card = screen.getByTestId('card');
		expect(card).toHaveClass('outlined');
	});

	it('applies elevated variant (default)', () => {
		const children = createTextSnippet('Body content');
		
		render(Card, {
			props: { children }
		});

		const card = screen.getByTestId('card');
		expect(card).toHaveClass('elevated');
	});
});
