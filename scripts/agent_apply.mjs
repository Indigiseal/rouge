// scripts/agent_apply.mjs
// Minimal, robust "apply first TODO" agent.
// - Reads the first unchecked item from TODO.md
// - Builds a compact repo snapshot
// - Asks the model for a JSON list of file edits
// - Writes those edits to disk (so the workflow can open a PR)

import fs from "fs/promises";
import path from "path";
import glob from "glob";
import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const REPO_ROOT = process.cwd();

// ---------- helpers ----------
async function readSafe(p) {
  try { return await fs.readFile(p, "utf8"); } catch { return ""; }
}

async function writeFileEnsured(filePath, contents) {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(filePath, contents, "utf8");
}

function extractFirstUncheckedTodo(md) {
  // Matches "- [ ] something" (unchecked)
  const m = md.match(/^- \[ \]\s+(.+)$/m);
  return m ? m[1].trim() : null;
}

async function listInterestingFiles() {
  return new Promise((resolve, reject) => {
    glob(
      "**/*.{js,ts,tsx,jsx,json,md,html,css,yml,yaml}",
      {
        cwd: REPO_ROOT,
        ignore: [
          "node_modules/**",
          ".git/**",
          "dist/**",
          "build/**",
          ".github/**", // keep YAML short; we already capture workflows separately if needed
        ],
        nodir: true,
        dot: false,
      },
      (err, files) => (err ? reject(err) : resolve(files.slice(0, 80))) // cap to keep prompt small
    );
  });
}

async function fileHeads(files, maxLines = 120) {
  const heads = [];
  for (const f of files) {
    const full = path.join(REPO_ROOT, f);
    const txt = await readSafe(full);
    const head = txt.split("\n").slice(0, maxLines).join("\n");
    heads.push(`--- ${f}\n${head}`);
  }
  return heads.join("\n\n");
}

function buildPrompt({ task, mechanics, agentGuide, repoList, repoHeads }) {
  return [
    {
      role: "system",
      content:
        "You are a careful coding agent working in a Phaser browser game repo. Generate small, safe edits only.",
    },
    {
      role: "user",
      content: [
        "PROJECT MECHANICS (source of truth):",
        "----------------------------------",
        mechanics || "(no MECHANICS.md)",
        "",
        "AGENT NOTES:",
        "------------",
        agentGuide || "(no AGENT.md)",
        "",
        "FIRST TODO TO APPLY:",
        "--------------------",
        `- ${task}`,
        "",
        "REPOSITORY INDEX (subset):",
        "--------------------------",
        repoList,
        "",
        "FILE HEADS (truncated):",
        "-----------------------",
        repoHeads,
        "",
        "OUTPUT FORMAT (STRICT):",
        "Return ONLY a JSON object in a fenced block like:",
        "```json",
        '{ "files": [ { "path": "<relative/path.ext>", "contents": "<full new file text>" } ] }',
        "```",
        "",
        "Rules:",
        "- Touch only files that are necessary.",
        "- Always include the full new content for each changed file (no patches).",
        "- Use existing code style. Keep edits minimal and safe.",
        "- If the change is too big, do the smallest viable step.",
      ].join("\n"),
    },
  ];
}

function extractJsonFromText(text) {
  const m = text.match(/```json
