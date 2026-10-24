import { sveltekit } from '@sveltejs/kit/vite';
import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [sveltekit({ adapter: adapter(), preprocess: vitePreprocess(), csp: {
    mode: 'auto', directives: { 'default-src': ['self'], 'base-uri': ['self'],
      'object-src': ['none'], 'frame-ancestors': ['none'], 'form-action': ['self'],
      'img-src': ['self', 'data:', 'https:'], 'style-src': ['self', 'unsafe-inline'] }
  } })],
  test: { environment: 'node', include: ['tests/**/*.test.ts'], exclude: ['tests/**/*.integration.test.ts'] }
});
