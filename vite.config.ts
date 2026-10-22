import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { execSync } from 'node:child_process';
import { versionName } from './src/versionName.js';

// The build id is the commit, or the time when there is no git. It is baked
// into the bundle and written to version.json so the running app can notice
// a newer deploy (src/version.ts). Copied from Höyry.
function buildId(): string {
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() || String(Date.now());
  } catch {
    return String(Date.now());
  }
}

function versionFile(id: string): Plugin {
  return {
    name: 'hiisi-version-json',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ build: id, name: versionName(id) }) });
    },
  };
}

// GitHub Pages serves the project site under https://vesahyp.github.io/hiisi/,
// so production builds and `vite preview` use that base. Dev stays at '/'.
export default defineConfig(({ command, isPreview }) => {
  const id = buildId();
  return {
    base: command === 'build' || isPreview ? '/hiisi/' : '/',
    plugins: [react(), versionFile(id)],
    define: { __BUILD__: JSON.stringify(id) },
    build: {
      rolldownOptions: {
        output: {
          codeSplitting: {
            groups: [{ name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ }],
          },
        },
      },
    },
  };
});
