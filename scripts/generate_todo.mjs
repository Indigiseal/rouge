// scripts/generate_todo.mjs
// Node 20 + ESM. Requires OPENAI_API_KEY secret in repo settings.

import fs from "fs/promises";
import path from "path";
import { glob } from "glob";
import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const REPO_ROOT = process.cwd();

// ---- helpers ---------------------------------------------------------------

async function readMechanics() {
  try {
    return await fs.readFile(path.join(REPO_ROOT, "docs/MECHANICS.md"), "utf8");
  } catch {
    return "";
  }
}

async function readAgent() {
  try {
    return await fs.readFile(path.join(REPO_ROOT, "docs/AGENT.md"), "utf8");
  } catch {
    return "";
  }
}

// Pick real code files in this repo layout (no src/ folder)
async function listImportantFiles() {
  const patterns = [
    "*.js",
    "scenes/**/*.js",
    "utils/**/*.js",
    "cards/**/*.js",
  ];
  const files = (
    await Promise.all(
      patterns.map((p) => glob(p, { cwd: REPO_ROOT, nodir: true }))
    )
  )
    .flat()
    // ignore build artifacts and this script
    .filter(
      (f) =>
        !f.startsWith("node_modules/") &&
        !f.startsWith(".github/") &&
        f !== "scripts/generate_todo.mjs"
    );

  // Pull a short “code head” from each file so the model knows what exists
  const samples = await Promise.all(
    files.slice(0, 60).map(async (rel) => {
      const full = path.join(REPO_ROOT, rel);
      const txt = await fs.readFile(full, "utf8").catch(() => "");
      // first ~1200 chars
      return `### ${rel}\n\`\`\`js\n${txt.slice(0, 1200)}\n\`\`\`\n`;
    })
  );

  return samples.join("\n");
}

function buildPrompt({ mech, agent, codeHeads }) {
  return [
    "You are a planning assistant for a Phaser card-roguelite.",
    "Produce a short, actionable TODO.md the team can follow THIS WEEK.",
    "",
    "Use this structure exactly:",
    "1. High-impact goals (3–5 bullets)",
    "2. Tasks (checkbox list, grouped by file; each task <= 1–2 lines)",
    "3. Test plan (bullet list with steps and expected outcomes)",
    "4. Risks & rollbacks (very short)",
    "",
    "Prioritize: Prompt 2 (melee front/back gating + initial reveal),",
    "then Prompt 3 (sockets + gem effects) and 3.1 AoE reveals closed cards.",
    "If something is ambiguous, write a tiny note but still propose tasks.",
    "",
    "=== MECHANICS (source of truth) ===",
    mech || "(missing)",
    "",
    "=== AGENT (style/constraints) ===",
    agent || "(missing)",
    "",
    "=== CODE HEADS (read-only snippets to infer file names) ===",
    codeHeads || "(none)",
  ].join("\n");
}

// ---- main ------------------------------------------------------------------

async function main() {
  const [mech, agent, codeHeads] = await Promise.all([
    readMechanics(),
    readAgent(),
    listImportantFiles(),
  ]);

  const userPrompt = buildPrompt({ mech, agent, codeHeads });

  console.log("🔧 Generating TODO.md with OpenAI…");

  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

  const completion = await client.chat.completions.create({
    model,
    temperature: 0.3,
    messages: [
      {
        role: "system",
        content:
          "Be concrete, concise, and file-oriented. Output valid Markdown only.",
      },
      { role: "user", content: userPrompt },
    ],
  });

  const text = completion?.choices?.[0]?.message?.content?.trim();
  if (!text) {
    throw new Error("No content returned from model.");
  }

  const outPath = path.join(REPO_ROOT, "TODO.md");
  await fs.writeFile(outPath, text, "utf8");
  console.log(`✅ Wrote ${outPath}`);
}

main().catch((err) => {
  console.error("❌ TODO generation failed:", err?.message || err);
  process.exitCode = 1;
});
