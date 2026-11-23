import { defineConfig } from 'vitest/config';

// base './' keeps every asset path relative, so the build works under
// https://cmartinez-sudo.github.io/finanzas-cs/ without hardcoding the repo name.
export default defineConfig({
  base: './',
  build: { target: 'es2022', sourcemap: true },
  test: { include: ['src/**/*.test.ts'], environment: 'node', passWithNoTests: true },
});
