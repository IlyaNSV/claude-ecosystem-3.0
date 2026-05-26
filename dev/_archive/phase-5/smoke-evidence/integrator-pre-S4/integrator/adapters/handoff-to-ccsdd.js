// handoff-to-ccsdd.js
// Adapter: product-module handoff.md -> cc-sdd /kiro-spec-init input
//
// @target_tool      cc-sdd
// @target_tool_version 3.0.2
// @contract_schema_version 1
// @source_ref       e248abd292ce907e7f612e8838125087159ee43a
// @installed_at     2026-05-26T11:00:00Z

"use strict";
var fs = require("fs");
var path = require("path");
var CONTRACT_SCHEMA_VERSION = 1;
var TOOL_VERSION = "3.0.2";

var args = process.argv.slice(2);
var verifyOnly = args.includes("--verify-only");
var allowDraft = args.includes("--allow-draft");
var fixtureIdx = args.indexOf("--fixture");
var fixturePath = fixtureIdx !== -1 ? args[fixtureIdx + 1] : null;

if (!fixturePath) {
  process.stderr.write("Usage: node handoff-to-ccsdd.js --fixture <path> [--verify-only] [--allow-draft]\n");
  process.exit(2);
}

function readFile(p) {
  try { return fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n"); }
  catch (err) { process.stderr.write("ERROR reading: " + p + "\n" + err.message + "\n"); process.exit(2); }
}

// Line-based frontmatter parser (not regex on multi-entry blocks - DEC-DEV-0031 A1)
function parseFrontmatter(content) {
  var lines = content.split("\n");
  if (lines[0].trim() !== "---") { return { meta: {}, body: content }; }
  var endIdx = -1;
  for (var i = 1; i < lines.length; i++) {
    if (lines[i].trim() === "---") { endIdx = i; break; }
  }
  if (endIdx === -1) { return { meta: {}, body: content }; }
  var fmLines = lines.slice(1, endIdx);
  var meta = {};
  var currentKey = null;
  var inList = false;
  var listValues = [];
  for (var li = 0; li < fmLines.length; li++) {
    var ln = fmLines[li];
    var kv = ln.match(/^([a-zA-Z_][a-zA-Z0-9_]*):\s*(.*)$/);
    if (kv && !ln.startsWith(" ") && !ln.startsWith("\t")) {
      if (currentKey && inList) { meta[currentKey] = listValues.slice(); }
      inList = false; listValues = [];
      currentKey = kv[1];
      var v = kv[2].trim();
      if (v === "" || v === "null") { meta[currentKey] = null; }
      else if (v === "true") { meta[currentKey] = true; }
      else if (v === "false") { meta[currentKey] = false; }
      else if (v.startsWith("[") && v.endsWith("]")) {
        var inner = v.slice(1, -1).trim(); meta[currentKey] = inner === "" ? [] : inner.split(",").map(function(s) { return s.trim(); });
      } else { meta[currentKey] = v.replace(/^"(.*)"$/, "$1"); }
      continue;
    }
    var lm = ln.match(/^\s+-\s+(.*)$/);
    if (lm && currentKey) {
      if (!inList) { inList = true; listValues = []; }
      listValues.push(lm[1].trim());
      meta[currentKey] = listValues.slice();
    }
  }
  if (currentKey && inList) { meta[currentKey] = listValues.slice(); }
  return { meta: meta, body: lines.slice(endIdx + 1).join("\n").trim() };
}

function validateContract(meta, body) {
  var checks = [];

  var idOk = typeof meta.id === "string" && /^HANDOFF-FM-\d{3}$/.test(meta.id);
  checks.push({ id: "C-01", level: "error", status: idOk ? "pass" : "fail",
    detail: idOk ? "id: " + meta.id : "id missing/malformed (expected HANDOFF-FM-NNN), got: " + meta.id });

  var typeOk = meta.type === "feature-handoff";
  checks.push({ id: "C-02", level: "error", status: typeOk ? "pass" : "fail",
    detail: typeOk ? "type: feature-handoff" : "type wrong/missing, got: " + meta.type });

  var featOk = typeof meta.feature === "string" && /^FM-\d{3}$/.test(meta.feature);
  checks.push({ id: "C-03", level: "error", status: featOk ? "pass" : "fail",
    detail: featOk ? "feature: " + meta.feature : "feature missing/malformed, got: " + meta.feature });

  var titleOk = typeof meta.title === "string" && meta.title.trim().length > 0;
  checks.push({ id: "C-04", level: "error", status: titleOk ? "pass" : "fail",
    detail: titleOk ? "title present" : "title missing or empty" });

  var stOk = typeof meta.status === "string";
  checks.push({ id: "C-05", level: "error", status: stOk ? "pass" : "fail",
    detail: stOk ? "status: " + meta.status : "status field missing" });

  if (stOk && (meta.status === "draft" || meta.status === "partial")) {
    checks.push({ id: "C-06", level: allowDraft ? "warn" : "error",
      status: allowDraft ? "warn" : "fail",
      detail: "Handoff status is \"" + meta.status + "\". Pass --allow-draft to bypass or use production handoff." });
  }

  var dorOk = meta.dor_validation_passed === true;
  checks.push({ id: "C-07", level: "warn", status: dorOk ? "pass" : "warn",
    detail: dorOk ? "dor_validation_passed: true" : "dor_validation_passed not true, got: " + meta.dor_validation_passed });

  var nbOk = Array.isArray(meta.blocking_issues) && meta.blocking_issues.length === 0;
  checks.push({ id: "C-08", level: "error", status: nbOk ? "pass" : "fail",
    detail: nbOk ? "No blocking issues" : "blocking_issues non-empty or missing" });

  var bodyOk = typeof body === "string" && body.length > 50;
  checks.push({ id: "C-09", level: "error", status: bodyOk ? "pass" : "fail",
    detail: bodyOk ? "Body present (" + body.length + " chars)" : "Body too short or missing" });

  checks.push({ id: "C-10", level: "warn", status: "warn",
    detail: "embedded_artifacts: object-valued fields not deep-parsed; manual drift check recommended" });

  var fails = checks.filter(function(c) { return c.level === "error" && c.status === "fail"; });
  return { passed: fails.length === 0, checks: checks };
}

function slugify(feature, title) {
  var base = feature.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  if (title) {
    var ts = title.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim().split(/\s+/).slice(0, 4).join("-");
    if (ts.length > 0) return base + "-" + ts;
  }
  return base;
}

function transform(meta, body) {
  var slug = slugify(meta.feature, meta.title);
  var execSummary = "";
  var em = body.match(/##\s+1\.\s+Executive\sSummary\s*\n([\s\S]*?)(?=\n##\s+\d+\.|$)/);
  if (em) execSummary = em[1].trim();
  var out = [];
  out.push("# Kiro Spec Brief: " + meta.feature + " - " + meta.title);
  out.push("");
  out.push("> Auto-generated by handoff-to-ccsdd.js (contract_schema_version: " + CONTRACT_SCHEMA_VERSION + ")");
  out.push("> Source: product-module | Target: cc-sdd " + TOOL_VERSION);
  out.push("> Handoff status: " + meta.status + " | Generated: " + meta.generated_at);
  out.push("");
  out.push("## Feature");
  out.push("**ID:** " + meta.feature);
  out.push("**Title:** " + meta.title);
  out.push("");
  if (execSummary.length > 0) {
    out.push("## Executive Summary");
    out.push(execSummary);
    out.push("");
  }
  out.push("## Full Handoff");
  out.push("");
  out.push(body);
  return { slug: slug, feature: meta.feature, briefContent: out.join("\n"), contract_schema_version: CONTRACT_SCHEMA_VERSION };
}

var content = readFile(fixturePath);
var parsed = parseFrontmatter(content);
var validation = validateContract(parsed.meta, parsed.body);

if (verifyOnly) {
  var r = { contract_validation: { passed: validation.passed,
    contract_schema_version: CONTRACT_SCHEMA_VERSION, fixture: fixturePath,
    checks: validation.checks } };
  process.stdout.write(JSON.stringify(r, null, 2) + "\n");
  process.exit(validation.passed ? 0 : 1);
}

if (!validation.passed) {
  process.stderr.write("Contract validation failed. Use --verify-only for details.\n");
  process.exit(1);
}

var t = transform(parsed.meta, parsed.body);
var specDir = path.join(".kiro", "specs", t.slug);
fs.mkdirSync(specDir, { recursive: true });
var briefPath = path.join(specDir, "brief.md");
fs.writeFileSync(briefPath, t.briefContent, "utf8");
process.stdout.write("Written: " + briefPath + "\n");
process.stdout.write("Next step: /kiro-spec-init " + t.slug + "\n");
process.exit(0);
