// scripts/agent_apply.mjs
// Creates a PR that implements the FIRST unchecked task in TODO.md.

import fs from "fs/promises";
import path from "path";
import { glob } from "glob";
import OpenAI from "openai";

const REPO_ROOT = process.cwd();
const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

function mustEnv(k) {
  const v = process.env[k];
  if (!v) throw new Error(`Missing env: ${k}`);
  return v;
}
mustEnv("OPENAI_API_KEY");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function readFileSafe(...parts) {
  try { return await fs.readFile(path.join(REPO_ROOT, ...parts), "utf8"); }
  catch { return ""; }
}

async function listImportantFiles() {
  const patterns = ["*.js","scenes/**/*.js","utils/**/*.js","cards/**/*.js"];
  const files = (await Promise.all(patterns.map(p => glob(p, { cwd: REPO_ROOT, nodir: true }))))
    .flat()
    .filter(f => !f.startsWith("node_modules/") && !f.startsWith(".github/"));
  const heads = await Promise.all(files.slice(0, 60).map(async (rel) => {
    const txt = await readFileSafe(rel);
    return `#
