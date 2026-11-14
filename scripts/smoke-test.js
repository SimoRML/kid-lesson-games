#!/usr/bin/env node
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

console.log('--- Starting Tarball Smoke Test ---');

const repoRoot = process.cwd();

// 1. Pack tarball
console.log('1. Packing tarball...');
execSync('npm pack', { stdio: 'inherit', cwd: repoRoot });

// Find the tarball
const tarballs = fs
  .readdirSync(repoRoot)
  .filter((f) => f.startsWith('simorml-kid-lesson-games-') && f.endsWith('.tgz'));

if (tarballs.length === 0) {
  throw new Error('No packed tarball found in workspace');
}

const tarballName = tarballs[0];
const tarballPath = path.join(repoRoot, tarballName);
console.log(`Found packed tarball: ${tarballName}`);

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kid-smoke-'));
console.log(`2. Created temporary workspace: ${tempDir}`);

try {
  // Copy tarball into temp directory
  fs.copyFileSync(tarballPath, path.join(tempDir, tarballName));

  // Initialize consumer package
  fs.writeFileSync(
    path.join(tempDir, 'package.json'),
    JSON.stringify(
      {
        name: 'smoke-consumer',
        version: '1.0.0',
        type: 'module',
        private: true
      },
      null,
      2
    )
  );

  console.log('3. Installing tarball into consumer workspace...');
  execSync(`npm install ./${tarballName}`, { cwd: tempDir, stdio: 'inherit' });

  console.log('4. Testing Node.js ESM import & SSR safety...');
  const testScript = `
    import {
      KidGameElement,
      registry,
      SoundEngine,
      I18nManager,
      CORE_DICTIONARY,
      createI18nResolver,
      interpolate
    } from '@simorml/kid-lesson-games';

    console.log('Checking exported identifiers...');
    if (!KidGameElement) throw new Error('KidGameElement missing');
    if (!registry) throw new Error('registry missing');
    if (!SoundEngine) throw new Error('SoundEngine missing');
    if (!I18nManager) throw new Error('I18nManager missing');

    console.log('Testing Node SSR instantiation...');
    const element = new KidGameElement();
    if (!(element instanceof KidGameElement)) {
      throw new Error('Failed to instantiate KidGameElement in Node');
    }

    console.log('Testing game registry population...');
    const games = registry.list();
    if (games.length !== 7) {
      throw new Error(\`Expected 7 registered games, got \${games.length}\`);
    }

    console.log(\`Successfully verified \${games.length} registered games in tarball!\`);
  `;

  fs.writeFileSync(path.join(tempDir, 'test-import.mjs'), testScript);
  execSync('node test-import.mjs', { cwd: tempDir, stdio: 'inherit' });

  console.log('--- Tarball Smoke Test Succeeded! ---');
} finally {
  // Clean up
  console.log('Cleaning up temporary files...');
  fs.rmSync(tempDir, { recursive: true, force: true });
  fs.rmSync(tarballPath, { force: true });
}
