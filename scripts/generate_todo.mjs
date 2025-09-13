// scripts/generate_todo.mjs
// Node 20 + ESM. Requires OPENAI_API_KEY repo secret.

import fs from "fs/promises";
import path from "path";
import { glob } from "glob";
import OpenAI from "openai";

const REPO_ROOT = process.cwd();

function assertEnv() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error(
      "OPENAI_API_KEY is missing. Add it in GitHub → Settings → Secrets and variables → Actions."
    );
  }
}
assertEnv();

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function readIfExists(...parts) {
  try { return await fs.readFile(path.join(REPO_ROOT, ...parts), "utf8"); }
  catch { return ""; }
}

async function listImportantFiles() {
  const patterns = ["*.js", "scenes/**/*.js", "utils/**/*.js", "cards/**/*.js"];
  const files = (await Promise.all(patterns.map((p) => glob(p, { cwd: REPO_ROOT, nodir: true }))))
    .flat()
    .filter((f) =>
      !f.startsWith("node_modules/") &&
      !f.startsWith(".github/") &&
      f !== "scripts/generate_todo.mjs"
    );

  const heads = await Promise.all(
    files.slice(0, 60).map(async (rel) => {
      const txt = await readIfExists(rel);
      return `### ${rel}\n\`\`\`js\n${txt.slice(0, 1200)}\n\`\`\`\n`;
    })
  );
  return heads.join("\n");
}

function buildPrompt({ mech, agent, codeHeads }) {
  return [
    "You are a planning assistant for a Phaser card-roguelite.",
    "Produce a concise TODO.md for THIS WEEK.",
    "",
    "Format:",
    "1. High-impact goals (3–5 bullets)",
    "2. Tasks (checkbox list grouped by file; 1–2 lines each)",
    "3. Test plan (steps + expected)",
    "4. Risks & rollbacks",
    "",
    "Priorities: Prompt 2 (melee front/back gating + initial reveal), then Prompt 3 + 3.1 (sockets/gems + AoE reveals).",
    "",
    "=== MECHANICS ===",
    mech || "(missing)",
    "",
    "=== AGENT ===",
    agent || "(missing)",
    "",
    "=== CODE HEADS ===",
    codeHeads || "(none)"
  ].join("\n");
}

async function main() {
  console.log("🔧 Reading inputs…");
  const [mech, agent, codeHeads] = await Promise.all([
    readIfExists("docs", "MECHANICS.md"),
    readIfExists("docs", "AGENT.md"),
    listImportantFiles(),
  ]);

  const prompt = buildPrompt({ mech, agent, codeHeads });
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

  console.log("🤖 Calling OpenAI model:", model);
  const completion = await client.chat.completions.create({
    model,
    temperature: 0.3,
    messages: [
      { role: "system", content: "Be concrete and file-oriented. Output valid Markdown only." },
      { role: "user", content: prompt },
    ],
  });

  const text = completion?.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("No content returned from model.");

  const out = path.join(REPO_ROOT, "TODO.md");
  await fs.writeFile(out, text, "utf8");
  console.log("✅ Wrote", out);
}

main().catch((err) => {
  console.error("❌ TODO generation failed:");
  console.error(err?.stack || err?.message || String(err));
  process.exitCode = 1;
});
