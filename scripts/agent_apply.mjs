// scripts/agent_apply.mjs
// Minimal, robust "generate a patch from first unchecked TODO task" runner.

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

function firstUncheckedTaskBlock(todo) {
  // Find first "- [ ]" task block; capture until next "- [ ]" at col start or EOF
  const start = todo.search(/^- \[ \]/m);
  if (start === -1) return null;

  const after = todo.slice(start);
  const next = after.search(/^\- \[ \]/m); // the first char of *this* block is 0
  // We want from this task to just before the *next* unchecked task.
  // So cut at the next occurrence in the *rest after first line*:
  const rest = after.slice(3); // just to ensure next search moves forward
  const second = rest.search(/^\- \[ \]/m);
  if (second === -1) return after.trim();
  return after.slice(0, 3 + second).trim();
}

function parseFilesFromBlock(block) {
  // Look for a line like:  **Files:** `cardSystem.js`   OR  Files: cardSystem.js
  // Capture comma/space separated paths inside backticks or plain text.
  const m =
    block.match(/Files:\s*`([^`]+)`/i) ||
    block.match(/\*\*Files:\*\*\s*`([^`]+)`/i) ||
    block.match(/Files:\s*([^\n]+)/i) ||
    block.match(/\*\*Files:\*\*\s*([^\n]+)/i);

  if (!m) return [];

  // Split by comma, backticks already stripped in first two branches.
  return m[1]
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

async function loadFileMap(paths) {
  const entries = [];
  for (const rel of paths) {
    const safe = rel.replace(/^\.?\/*/, ""); // strip leading ./ or /
    const abs = path.join(ROOT, safe);
    try {
      const content = await readUtf8(abs);
      entries.push({ path: safe, content });
    } catch (e) {
      // Non-fatal: we still proceed, but patch may add the file.
      console.warn(`[agent] Warn: could not read ${safe} (${e.message})`);
      entries.push({ path: safe, content: null });
    }
  }
  return entries;
}

function extractJsonBlock(text) {
  // Robustly extract JSON from a fenced block, or parse the whole string as JSON.
  // 1) ```json ... ```
  let m = text.match(/```json\s*([\s\S]*?)```/i);
  if (m && m[1]) {
    try {
      return JSON.parse(m[1]);
    } catch {}
  }
  // 2) ``` ... ```
  m = text.match(/```\s*([\s\S]*?)```/);
  if (m && m[1]) {
    try {
      return JSON.parse(m[1]);
    } catch {}
  }
  // 3) raw JSON
  try {
    return JSON.parse(text);
  } catch (e) {
    die(
      "[agent] Could not parse model response as JSON. Enable logs and check the response format."
    );
  }
}

function validatePatch(patch) {
  // Minimal sanity: unified diff typically contains '--- ' and '+++ '
  return typeof patch === "string" && /(^|\n)---\s/.test(patch) && /(^|\n)\+\+\+\s/.test(patch);
}

async function main() {
  const todoPath = path.join(ROOT, "TODO.md");
  let todo;
  try {
    todo = await readUtf8(todoPath);
  } catch (e) {
    die("[agent] TODO.md not found in repo root.");
  }

  const block = firstUncheckedTaskBlock(todo);
  if (!block) die("[agent] No unchecked task found in TODO.md (look for '- [ ]').");

  const files = parseFilesFromBlock(block);
  if (!files.length) {
    console.warn("[agent] No 'Files:' line found; defaulting to cardSystem.js");
    files.push("cardSystem.js");
  }

  const fileMap = await loadFileMap(files);

  // Compose the prompt
  const sys = `
You are a disciplined code patch generator.
- Only implement the FIRST unchecked task block provided.
- Produce a single JSON object with keys:
  { "unified_patch": "<unified diff patch>", "task": "<one-line task title>" }
- The patch MUST be a valid unified diff that applies at repo root with \`git apply --whitespace=fix agent.patch\`.
- Do not rename files or change unrelated code.
- Only modify files listed under "Files".
- Keep changes minimal and add console logs exactly as requested.
  `.trim();

  const user = `
Repository context:
${fileMap
  .map(
    (f) =>
      `BEGIN_FILE ${f.path}
${f.content ?? "(file not found; you may create it, but prefer editing existing files)"}
END_FILE`
  )
  .join("\n\n")}

FIRST UNCHECKED TASK (implement exactly this and nothing else):
${block}

Return ONLY a JSON object inside a \`\`\`json code fence with keys:
- unified_patch: a valid unified diff (diff --git …, --- a/…, +++ b/…, @@ …)
- task: a short one-line summary
`.trim();

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  if (!client.apiKey) die("[agent] Missing OPENAI_API_KEY secret.");

  const resp = await client.chat.completions.create({
    model: MODEL,
    temperature: 0.2,
    messages: [
      { role: "system", content: sys },
      { role: "user", content: user },
    ],
  });

  con
