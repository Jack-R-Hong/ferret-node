import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vitest/config';

// Standalone test config (decoupled from the SvelteKit build in vite.config.ts).
// The bare `svelte()` plugin compiles `.svelte` components and `.svelte.ts` rune
// modules (the stores) so `$state` works under Vitest; jsdom gives the stores
// and client a browser-like global (window/navigator/atob/btoa).
export default defineConfig({
	plugins: [svelte()],
	test: {
		environment: 'jsdom',
		include: ['src/**/*.{test,spec}.{js,ts}'],
		clearMocks: true,
		coverage: {
			provider: 'v8',
			include: ['src/lib/**/*.{ts,svelte}'],
			exclude: ['src/lib/**/*.{test,spec}.ts', 'src/lib/index.ts', 'src/lib/types.ts']
		}
	}
});
