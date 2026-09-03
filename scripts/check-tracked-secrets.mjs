#!/usr/bin/env node
import { execFileSync } from 'node:child_process';

const tracked = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
  .split('\0')
  .filter(Boolean);

const blockedExt = /\.(pem|key|p12|pfx|crt|cer|jks)$/i;
const blocked = [];

for (const file of tracked) {
  const leaf = file.replace(/^.*[\\/]/, '');
  if (leaf === '.env.example') continue;
  if (leaf === '.env' || leaf.startsWith('.env.')) {
    blocked.push(file);
    continue;
  }
  if (blockedExt.test(leaf)) blocked.push(file);
}

if (blocked.length) {
  console.error('Tracked env/key/pem files are not allowed:');
  for (const file of blocked) console.error(`  ${file}`);
  process.exit(1);
}

console.log('No tracked env/key/pem files (.env.example allowed).');
