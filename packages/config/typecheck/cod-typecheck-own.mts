#!/usr/bin/env node
// The `cod-typecheck-own` bin. It always runs (no entry-point check), so it can never exit 0 unchecked.
import console from 'node:console';
import { relative, resolve } from 'node:path';
import process from 'node:process';
import ts from 'typescript';
import { ownDiagnostics } from './own-sources.mts';

/** `sysexits.h` EX_USAGE: the command was called without its tsconfig argument. */
const EXIT_USAGE = 64;

const formatHost: ts.FormatDiagnosticsHost = {
  getCanonicalFileName: (fileName) => fileName,
  getCurrentDirectory: () => process.cwd(),
  getNewLine: () => '\n',
};

const tsconfigPath = process.argv[2];
if (!tsconfigPath) {
  console.error('usage: cod-typecheck-own <tsconfig.json>');
  process.exit(EXIT_USAGE);
}
const diagnostics = ownDiagnostics(tsconfigPath);
if (diagnostics.length > 0) {
  console.error(ts.formatDiagnosticsWithColorAndContext(diagnostics, formatHost));
  console.error(`${String(diagnostics.length)} error(s) in ${relative(process.cwd(), resolve(tsconfigPath))}`);
  process.exit(1);
}
