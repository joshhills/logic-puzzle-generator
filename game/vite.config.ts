import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
    build: {
        target: 'esnext'
    },
    resolve: {
        alias: {
            'logic-puzzle-generator': path.resolve(__dirname, '../src/index.ts')
        }
    },
    server: {
        port: 3000
    }
});
