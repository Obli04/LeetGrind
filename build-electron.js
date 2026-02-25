const esbuild = require('esbuild');
const { readFileSync } = require('fs');

const packageJson = JSON.parse(readFileSync('./package.json', 'utf8'));
const external = [
  ...Object.keys(packageJson.dependencies || {}),
  ...Object.keys(packageJson.devDependencies || {}),
  'electron'
];

async function build() {
  await esbuild.build({
    entryPoints: ['electron/main.ts'],
    bundle: true,
    platform: 'node',
    target: 'node18',
    outfile: 'dist-electron/main.js',
    external,
  });

  await esbuild.build({
    entryPoints: ['electron/preload.ts'],
    bundle: true,
    platform: 'node',
    target: 'node18',
    outfile: 'dist-electron/preload.js',
    external: ['electron'],
  });

  console.log('✓ Electron files built successfully');
}

build().catch((err) => {
  console.error('Build failed:', err);
  process.exit(1);
});
