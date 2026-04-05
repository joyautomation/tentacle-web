import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import ThemeSwitch from '$lib/components/ThemeSwitch.svelte';

// Mock the theme state module used by ThemeSwitch
vi.mock('../../../../src/routes/theme.svelte', () => {
	let current = 'themeSystem';
	return {
		themeState: {
			get value() {
				return current;
			},
			set: vi.fn((v: string) => {
				current = v;
			}),
			initialize: vi.fn()
		}
	};
});

describe('ThemeSwitch', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('renders three theme option buttons', () => {
		render(ThemeSwitch);

		const buttons = screen.getAllByRole('button');
		expect(buttons).toHaveLength(3);
	});

	it('has accessible title attributes for each option', () => {
		render(ThemeSwitch);

		expect(screen.getByTitle('System')).toBeInTheDocument();
		expect(screen.getByTitle('Light')).toBeInTheDocument();
		expect(screen.getByTitle('Dark')).toBeInTheDocument();
	});

	it('marks the current theme button as active', () => {
		render(ThemeSwitch);

		const systemButton = screen.getByTitle('System');
		expect(systemButton).toHaveClass('active');
	});

	it('contains SVG icons in each button', () => {
		render(ThemeSwitch);

		const buttons = screen.getAllByRole('button');
		for (const button of buttons) {
			expect(button.querySelector('svg')).not.toBeNull();
		}
	});
});
