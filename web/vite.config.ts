import { sveltekit } from '@sveltejs/kit/vite';
import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [sveltekit({ adapter: adapter(), preprocess: vitePreprocess() })],
  test: { environment: 'node', include: ['tests/**/*.test.ts'], exclude: ['tests/**/*.integration.test.ts'] }
});
