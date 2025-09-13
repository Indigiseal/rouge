// npm i openai glob (installed by the workflow)
import fs from "fs/promises";
import path from "path";
import { glob } from "glob";
import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const REPO_ROOT = path.resolve(process.cwd());

async function readMechanics() {
  try {
    return await fs.readFile(path.join(REPO_ROOT, "docs/MECHANICS.md"), "utf8");
  } catch { return ""; }
}

async function listImportantFiles() {
  const files = await glob("src/**/*.js", { cwd: REPO_ROOT, nodir: true });
  const samples = await Promise.all(
    files.slice(0, 40).map(async f => {
      const full = path.join(REPO_ROOT, f);
      const txt  = await fs.readFile(full, "utf8");
      return `### ${f}\n` + txt.slice(0, 1200);
    })
  );
  return samples.join("\n\n");
}

function prompt(mech, codeHeads) {
  return `You are a planning assistant for a Phaser card-roguelite.

MECHANICS (source of truth)
---------------------------
${mech}

CODE HEADS (context)
--------------------
${codeHeads}

Write a concise TODO.md with three sections: Now, Next, Later.
Each task must include:
- [ ] Title (imperative)
- Files touched
- Acceptance criteria (bullet list)
- How to test (one-liner)
Constraints:
- No renames of public APIs or save fields
- Prefer minimal patches
Output only the markdown content for TODO.md.`;
}

async function main() {
  const mech = await readMechanics();
  const code = await listImportantFiles();
  const res = await client.chat.completions.create({
    model: process.env.TODO_MODEL || "gpt-4o-mini",
    temperature: 0.2,
    messages: [{ role: "user", content: prompt(mech, code) }]
  });
  const md = res.choices[0].message.content || "# TODO\n\n(Agent produced empty output)";
  await fs.writeFile(path.join(REPO_ROOT, "TODO.md"), md, "utf8");
  console.log("Wrote TODO.md");
}

main().catch(e => { console.error(e); process.exit(1); });
