import { defineConfig } from 'vite';
export default defineConfig({ base: './', server: { port: 5177 }, build: { assetsInlineLimit: 0 } });
