#!/usr/bin/env node
/**
 * audit-index.js — Node helper module for reading/writing
 * dev/meta-improvement/audit-index.md.
 *
 * The hook (hooks/session-audit.js) does NOT depend on this module — it
 * inlines its own minimal append logic to stay self-contained. This
 * module is consumed by scripts/audit-smoke.js for richer queries
 * (parse Pending, move to Processed, format Processed rows).
 *
 * Per DEC-DEV-0034.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const PENDING_START = '<!-- PENDING_ROWS_START -->';
const PENDING_END = '<!-- PENDING_ROWS_END -->';
const PROCESSED_START = '<!-- PROCESSED_ROWS_START -->';
const PROCESSED_END = '<!-- PROCESSED_ROWS_END -->';

function getIndexPath(repoRoot) {
  return path.join(repoRoot, 'dev', 'meta-improvement', 'audit-index.md');
}

function readIndex(repoRoot) {
  return fs.readFileSync(getIndexPath(repoRoot), 'utf-8');
}

function extractSection(content, startMarker, endMarker) {
  const start = content.indexOf(startMarker);
  const end = content.indexOf(endMarker);
  if (start === -1 || end === -1 || end < start) {
    throw new Error(`audit-index sentinels missing or malformed: ${startMarker} / ${endMarker}`);
  }
  return content.slice(start + startMarker.length, end);
}

function parseTableRows(text) {
  const rows = [];
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) continue;
    if (/^\|[-:|\s]+\|$/.test(trimmed)) continue; // separator
    const cells = trimmed.slice(1, -1).split('|').map((c) => c.trim());
    rows.push(cells);
  }
  return rows;
}

function unbacktick(s) {
  const m = (s || '').match(/^`(.*)`(?:\s*\(reason:\s*([^)]*)\))?$/);
  if (m) return { value: m[1], reason: m[2] };
  return { value: s, reason: null };
}

function parsePending(content) {
  const section = extractSection(content, PENDING_START, PENDING_END);
  const rows = parseTableRows(section);
  return rows.map((cells) => {
    const [sid, ended_at, target, tpath] = cells;
    const sidMatch = unbacktick(sid);
    const tpathMatch = unbacktick(tpath);
    return {
      session_id: sidMatch.value,
      ended_at: ended_at,
      target_project: target,
      transcript_path: tpathMatch.value,
      reason: tpathMatch.reason || null,
    };
  });
}

function parseProcessed(content) {
  const section = extractSection(content, PROCESSED_START, PROCESSED_END);
  const rows = parseTableRows(section);
  return rows.map((cells) => {
    const [sid, audited_at, target, phase, mode, status, coverage, findings, report] = cells;
    return {
      session_id: unbacktick(sid).value,
      audited_at,
      target_project: target,
      phase,
      mode,
      status,
      coverage_string: coverage,
      findings_string: findings,
      report_path: unbacktick(report).value,
    };
  });
}

function sessionIdExists(content, sessionId) {
  // Check both Pending and Processed sections via raw match — cheap.
  return content.includes(`\`${sessionId}\``);
}

function formatPendingRow(marker) {
  // marker: { session_id, ended_at, target_project, transcript_path, reason? }
  const reasonNote = marker.reason ? ` (reason: ${marker.reason})` : '';
  return `| \`${marker.session_id}\` | ${marker.ended_at} | ${marker.target_project} | \`${marker.transcript_path}\`${reasonNote} |`;
}

function formatProcessedRow(entry) {
  // entry: { session_id, audited_at, target_project, phase, mode, status,
  //          coverage_summary: {covered,partial,fail,not_covered,uncertain},
  //          findings_count: {blocking,warning,info}, report_path }
  const c = entry.coverage_summary || {};
  const f = entry.findings_count || {};
  const coverage = `${c.covered || 0}/${c.partial || 0}/${c.fail || 0}/${c.not_covered || 0}/${c.uncertain || 0}`;
  const findings = `${f.blocking || 0}/${f.warning || 0}/${f.info || 0}`;
  const reportRel = entry.report_path
    ? `[\`${path.basename(entry.report_path)}\`](audit-reports/${path.basename(entry.report_path)})`
    : '—';
  return `| \`${entry.session_id}\` | ${entry.audited_at} | ${entry.target_project || '—'} | ${entry.phase || '—'} | ${entry.mode || '—'} | ${entry.status} | ${coverage} | ${findings} | ${reportRel} |`;
}

function writeAtomic(targetPath, content) {
  const tmp = `${targetPath}.tmp.${process.pid}`;
  fs.writeFileSync(tmp, content);
  fs.renameSync(tmp, targetPath);
}

function appendPending(repoRoot, marker) {
  // Returns true if appended, false if session_id already exists.
  const indexPath = getIndexPath(repoRoot);
  const content = readIndex(repoRoot);
  if (sessionIdExists(content, marker.session_id)) return false;
  const start = content.indexOf(PENDING_START);
  if (start === -1) throw new Error('PENDING_START sentinel not found');
  const head = content.slice(0, start + PENDING_START.length);
  const tail = content.slice(start + PENDING_START.length);
  const row = formatPendingRow(marker);
  writeAtomic(indexPath, `${head}\n${row}${tail}`);
  return true;
}

function moveToProcessed(repoRoot, sessionId, processedEntry) {
  const indexPath = getIndexPath(repoRoot);
  let content = readIndex(repoRoot);

  // 1. Remove from Pending — keep only lines NOT containing this session_id
  const pStart = content.indexOf(PENDING_START);
  const pEnd = content.indexOf(PENDING_END);
  if (pStart === -1 || pEnd === -1) throw new Error('Pending sentinels not found');
  const pendingSection = content.slice(pStart + PENDING_START.length, pEnd);
  const cleanedPending = pendingSection
    .split('\n')
    .filter((line) => !line.includes(`\`${sessionId}\``))
    .join('\n');

  content = content.slice(0, pStart + PENDING_START.length) + cleanedPending + content.slice(pEnd);

  // 2. Remove any existing Processed row for this session_id (force-mode case)
  const prStart = content.indexOf(PROCESSED_START);
  const prEnd = content.indexOf(PROCESSED_END);
  if (prStart === -1 || prEnd === -1) throw new Error('Processed sentinels not found');
  const processedSection = content.slice(prStart + PROCESSED_START.length, prEnd);
  const cleanedProcessed = processedSection
    .split('\n')
    .filter((line) => !line.includes(`\`${sessionId}\``))
    .join('\n');

  content = content.slice(0, prStart + PROCESSED_START.length) + cleanedProcessed + content.slice(prEnd);

  // 3. Insert new Processed row
  const newRow = formatProcessedRow({ ...processedEntry, session_id: sessionId });
  const insertAt = content.indexOf(PROCESSED_START);
  const head = content.slice(0, insertAt + PROCESSED_START.length);
  const tail = content.slice(insertAt + PROCESSED_START.length);
  writeAtomic(indexPath, `${head}\n${newRow}${tail}`);
}

module.exports = {
  PENDING_START,
  PENDING_END,
  PROCESSED_START,
  PROCESSED_END,
  getIndexPath,
  readIndex,
  parsePending,
  parseProcessed,
  sessionIdExists,
  formatPendingRow,
  formatProcessedRow,
  appendPending,
  moveToProcessed,
  writeAtomic,
};
