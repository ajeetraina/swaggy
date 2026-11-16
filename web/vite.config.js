import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Without this config the @vitejs/plugin-react dependency is never applied, so
// Vite falls back to esbuild's classic JSX transform (React.createElement) and
// does not auto-import React — producing "React is not defined" at runtime in
// components that don't import React. The plugin enables the automatic JSX
// runtime, so no per-file React import is required.
export default defineConfig({
  plugins: [react()],
});
