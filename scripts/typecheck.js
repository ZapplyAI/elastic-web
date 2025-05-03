#!/usr/bin/env node

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

// Ensure the tsconfig.typecheck.json file exists
if (!fs.existsSync('tsconfig.typecheck.json')) {
  console.log('Creating tsconfig.typecheck.json...');
  fs.writeFileSync(
    'tsconfig.typecheck.json',
    JSON.stringify({
      extends: './tsconfig.json',
      exclude: ['build/**/*']
    }, null, 2)
  );
}

try {
  // Run TypeScript compiler and capture output
  const output = execSync('tsc --project tsconfig.typecheck.json', { encoding: 'utf8', stdio: 'pipe' });
  console.log(output);
  process.exit(0);
} catch (error) {
  // Filter out errors related to Link redeclaration in build directory
  const errorLines = error.stdout.split('\n');
  const filteredErrors = errorLines.filter(line => !line.includes('build/server/assets/server-build') || !line.includes('Cannot redeclare block-scoped variable \'Link\''));

  // Check if there are any other errors
  const hasOtherErrors = filteredErrors.some(line => line.includes('error TS'));

  if (hasOtherErrors) {
    console.log(filteredErrors.join('\n'));
    process.exit(1);
  } else {
    console.log('TypeScript check passed (ignoring Link redeclaration errors in build directory)');
    process.exit(0);
  }
}
