#!/usr/bin/env node
// Reads a local Semgrep or axe JSON report and gates on severity.
// Exit 0: nothing blocking. 1: blocking findings. 2: bad invocation or unusable report.
import { readFileSync } from 'node:fs';

const [tool, file, ...extra] = process.argv.slice(2);
if (!['semgrep', 'axe'].includes(tool) || !file || extra.length) {
  console.error('quality-gate: usage: node quality-gate.mjs <semgrep|axe> <report.json>');
  process.exit(2);
}

try {
  const report = JSON.parse(readFileSync(file, 'utf8'));
  let levels, allowed, blocking;
  if (tool === 'semgrep') {
    // Reject partial scans: scan errors or no scanned paths must not read as clean.
    if (!Array.isArray(report?.results) || !Array.isArray(report.errors) || report.errors.length
        || !Array.isArray(report.paths?.scanned) || !report.paths.scanned.length) {
      throw new Error('incomplete scan');
    }
    levels = report.results.map((r) => r?.extra?.severity);
    allowed = ['INFO', 'WARNING', 'ERROR', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
    blocking = ['ERROR', 'HIGH', 'CRITICAL'];
  } else {
    // A browser error page can look like an empty accessibility scan, so require real http(s) pages.
    if (!Array.isArray(report) || !report.length
        || report.some((p) => !Array.isArray(p?.violations) || typeof p.url !== 'string'
          || !['http:', 'https:'].includes(new URL(p.url).protocol))) {
      throw new Error('incomplete scan');
    }
    levels = report.flatMap((p) => p.violations.map((v) => v?.impact));
    allowed = ['minor', 'moderate', 'serious', 'critical'];
    blocking = ['serious', 'critical'];
  }
  if (levels.some((l) => !allowed.includes(l))) throw new Error('unknown severity');
  const count = levels.filter((l) => blocking.includes(l)).length;
  console.log(`${tool}: ${levels.length} findings, ${count} blocking`);
  process.exitCode = count ? 1 : 0;
} catch {
  console.error('quality-gate: report unreadable, incomplete, or unsupported; check the scanner output');
  process.exitCode = 2;
}
