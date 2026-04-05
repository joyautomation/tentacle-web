import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { svelteTesting } from '@testing-library/svelte/vite';

export default defineConfig({
	plugins: [svelte({ hot: false }), svelteTesting()],
	test: {
		environment: 'jsdom',
		include: ['src/**/*.test.ts', 'tests/unit/**/*.test.ts'],
		globals: true,
		setupFiles: ['./tests/setup.ts'],
		css: true,
		coverage: {
			provider: 'v8',
			reporter: ['text', 'html', 'lcov'],
			reportsDirectory: './coverage',
			include: ['src/**/*.{ts,svelte}'],
			exclude: ['src/**/*.test.ts', 'src/**/$types.ts', 'src/**/$types.d.ts', 'src/app.d.ts']
		},
		alias: {
			$lib: '/src/lib',
			'$lib/': '/src/lib/',
			'$app/navigation': '/tests/mocks/$app/navigation.ts',
			'$app/stores': '/tests/mocks/$app/stores.ts',
			'$app/environment': '/tests/mocks/$app/environment.ts',
			'$env/dynamic/private': '/tests/mocks/$env/dynamic/private.ts'
		}
	}
});
