#!/usr/bin/env node
//
// `npm run dev` from the repo root. Dispatches to the platform's bring-up
// script: dev-up.ps1 on Windows, dev-up.sh everywhere else.
//
// The two scripts spell their one flag differently (-Reset vs --reset), so
// this normalises `npm run dev -- --reset` to whichever form the target wants.
// Anything else is passed through untouched.
//
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const isWindows = process.platform === 'win32';

const args = process.argv.slice(2).map((arg) =>
  /^--?reset$/i.test(arg) ? (isWindows ? '-Reset' : '--reset') : arg,
);

const [command, commandArgs] = isWindows
  ? [
      'powershell.exe',
      // -NoProfile so a slow or noisy user profile can't affect the run.
      // -ExecutionPolicy Bypass because the default Restricted policy blocks
      // unsigned local .ps1 files, which is the usual first-run failure here.
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', join(here, 'dev-up.ps1'), ...args],
    ]
  : ['bash', [join(here, 'dev-up.sh'), ...args]];

// stdio: 'inherit' matters — dev-up.ps1 asks a y/N question when it finds a
// half-applied migration, and that prompt has to reach the real terminal.
const child = spawn(command, commandArgs, { stdio: 'inherit' });

child.on('error', (error) => {
  console.error(`Could not start ${command}: ${error.message}`);
  process.exit(1);
});

child.on('exit', (code, signal) => {
  process.exit(signal ? 1 : code ?? 1);
});
