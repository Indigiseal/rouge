// scripts/agent_apply.mjs
// Generate a patch for the FIRST unchecked task in TODO.md and write agent.patch + agent_task.txt

import fs from "fs/promises";
import path from "path";
import process from "process";
import OpenAI from "openai";

const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const ROOT = process.cwd();

function die(msg) {
  console.error(msg);
  process.exit(1);
}

async function readUtf8(p) {
  return fs.readFile(p, "utf8");
}

function findFirstUncheckedBlock(todoText) {
  const lines = todoText.split("\n");
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*-\s*\[\s*\]\s*/.test(lines[i])) {
      start = i;
      break;
    }
  }
  if (start === -1) return null;

  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^\s*-\s*\[\s*\]\s*/.test(lines[i])) {
      end = i;
      break;
    }
  }
  return lines.slice(start, end).join("\n").trim();
}

function parseFilesFromBlock(block) {
  // Look for a line containing "Files:"
  const filesLine = block.split("\n").find((l) => /files:/i.test(l));
  if (!filesLine) return [];

  // Try to extract backticked paths first
  const tickMatches = [...filesLine.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
  let raw = tickMatches.length ? tickMatches.join(",") : filesLine.replace(/.*files:/i, "");

  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => s.replace(/^\.?\/*/, "")); // strip leading ./ or /
}

async function loadFiles(paths) {
  const out = [];
  for (const rel of paths) {
    const abs = path.join(ROOT, rel);
    try {
      const content = await readUtf8(abs);
      out.push({ path: rel, content });
    } catch (e) {
      console.warn(`[agent] warn: could not read ${rel} (${e.message})`);
      out.push({ path: rel, content: null });
    }
  }
  return out;
}

function extractJsonFromResponse(text) {
  // Try ```json ... ```
  let m = text.match(/```json\s*([\s\S]*?)```/i);
  if (m && m[1]) {
    try { return JSON.parse(m[1]); } catch {}
  }
  // Try ``` ... ```
  m = text.match(/```\s*([\s\S]*?)```/);
  if (m && m[1]) {
    try { return JSON.parse(m[1]); } catch {}
  }
  // Try raw
  try { return JSON.parse(text); } catch {}
  return null;
}

function isValidUnifiedDiff(patch) {
  if (typeof patch !== "string" || !patch.trim()) return false;
  // Look for typical unified diff markers
  return /(^|\n)diff --git /.test(patch) || ((/(^|\n)---\s/.test(patch)) && (/(^|\n)\+\+\+\s/.test(patch)));
}

async function main() {
  // 1) Read TODO
  let todo;
  try {
    todo = await readUtf8(path.join(ROOT, "TODO.md"));
  } catch {
    die("[agent] TODO.md not found in repo root.");
  }

  const block = findFirstUncheckedBlock(todo);
  if (!block) die("[agent] No unchecked task found in TODO.md (look for '- [ ]').");

  // 2) Figure out which files we’re allowed to touch
  let files = parseFilesFromBlock(block);
  if (!files.length) {
    console.warn("[agent] No 'Files:' line detected; defaulting to cardSystem.js");
    files = ["cardSystem.js"];
  }
  const fileMap = await loadFiles(files);

  // 3) Build prompts (no tricky backticks)
  const sys = [
    "You are a disciplined code patch generator.",
    "- Only implement the FIRST unchecked task block provided.",
    "- Return a single JSON object with keys:",
    '  {"unified_patch":"<unified diff>", "task":"<short one line>"}',
    "- The patch MUST be a valid unified diff (git apply --whitespace=fix agent.patch).",
    "- Only modify files listed under 'Files'. Keep changes minimal.",
  ].join("\n");

  const repoContext = fileMap.map((f) => {
    const body = (f.content == null)
      ? "(file not found; you may create it if needed, but prefer editing existing code)"
      : f.content;
    return `BEGIN_FILE ${f.path}\n${body}\nEND_FILE`;
  }).join("\n\n");

  const user = [
    "Repository context:",
    repoContext,
    "",
    "FIRST UNCHECKED TASK (implement exactly this and nothing else):",
    block,
    "",
    "Return ONLY JSON (no prose, no code fences) with keys unified_patch and task."
  ].join("\n");

  // 4) Call OpenAI
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) die("[agent] Missing OPENAI_API_KEY secret.");
  const client = new OpenAI({ apiKey });

  const resp = await client.chat.completions.create({
    model: MODEL,
    temperature: 0.2,
    messages: [
      { role: "system", content: sys },
      { role: "user", content: user },
    ],
  });

  const raw = resp.choices?.[0]?.message?.content || "";
  const data = extractJsonFromResponse(raw) ?? (() => { try { return JSON.parse(raw); } catch { return null; } })();
  if (!data) {
    console.error("----- RAW MODEL OUTPUT START -----");
    console.error(raw);
    console.error("----- RAW MODEL OUTPUT END -----");
    die("[agent] Model did not return parseable JSON.");
  }

  const patch = data.unified_patch || data.patch || data.diff || "";
  if (!isValidUnifiedDiff(patch)) {
    console.error("----- RAW MODEL OUTPUT START -----");
    console.error(raw);
    console.error("----- RAW MODEL OUTPUT END -----");
    die("[agent] Invalid or empty unified diff in response.");
  }

  await fs.writeFile(path.join(ROOT, "agent.patch"), patch, "utf8");
  await fs.writeFile(path.join(ROOT, "agent_task.txt"), (data.task || "Auto task") + "\n\n" + block + "\n", "utf8");
  console.log("[agent] Wrote agent.patch and agent_task.txt successfully.");
}

main().catch((e) => die(`[agent] Fatal: ${e.stack || e.message}`));
