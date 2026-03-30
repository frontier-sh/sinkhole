import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  if (mode === 'client') {
    return {
      plugins: [tailwindcss()],
      build: {
        outDir: './dist/assets',
        rollupOptions: {
          input: ['./src/client/styles/main.css'],
          output: {
            assetFileNames: '[name].[ext]',
          },
        },
        emptyOutDir: false,
        copyPublicDir: false,
      },
    };
  }

  return {
    plugins: [tailwindcss()],
    build: {
      outDir: './dist',
      ssr: true,
      rollupOptions: {
        input: './src/index.ts',
        external: ['cloudflare:workers'],
        output: {
          entryFileNames: 'index.js',
          format: 'esm',
        },
      },
      emptyOutDir: false,
      copyPublicDir: false,
    },
  };
});
