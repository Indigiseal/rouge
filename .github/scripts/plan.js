// .github/scripts/plan.js
// Reads docs/MECHANICS.md and writes TODO.md.
// If OPENAI_API_KEY is present, asks the model to produce a clean checklist.
// If not, falls back to a simple heuristic TODO so the workflow still works.

const fs = require('fs');
const path = require('path');

const root = process.cwd();
const mechPath = path.join(root, 'docs', 'MECHANICS.md');
const todoPath = path.join(root, 'TODO.md');

function readFileSafe(p, fallback = '') {
  try { return fs.readFileSync(p, 'utf8'); } catch { return fallback; }
}

function writeFile(p, text) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, text);
}

function heuristicTodo(mechText) {
  const lines = mechText.split('\n').map(l => l.trim()).filter(Boolean);
  const hasFrontBack = lines.some(l => /front/i.test(l) && /back/i.test(l));
  const hasReveal = lines.some(l => /reveal/i.test(l));
  const hasPenalty = lines.some(l => /penalt/i.test(l));

  return `# TODO

> Auto-generated (no API key found). Edit freely.

## Prompt 2 – Front/Back enemies + initial reveal
- [ ] Add helper \`currentFrontRowR()\`
- [ ] Add helper \`enemiesInRow(r, { revealedOnly })\`
- [ ] Gate melee: only hit enemies in \`currentFrontRowR()\`${hasPenalty ? '\n- [ ] Apply ranged damage multiplier (e.g. 0.8)' : ''}
- [ ] On spawn: reveal 2–3 enemies (≥1 from front row${hasReveal ? ', others behind' : ''})
- [ ] On front row cleared: reveal one enemy behind
- [ ] Log: initial reveal / melee blocked / reveal behind

## Tests
- [ ] Start: 2–3 enemies revealed
- [ ] Melee cannot hit backline while front exists
- [ ] Clearing front reveals a new enemy behind
`;
}

async function callOpenAI(mechText) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const system = [
    "You are a senior JS game dev. Output ONLY a Markdown checklist.",
    "Context: Phaser roguelite with brick grid board and enemies.",
    "Goal: Produce a concise TODO for Prompt 2 (melee front-row gating + initial reveal).",
    "Keep it actionable and grouped (Implementation / Tests)."
  ].join(' ');

  const user = [
    "MECHANICS.md contents:",
    "```",
    mechText,
    "```",
    "Requirements:",
    "- Helpers: currentFrontRowR(), enemiesInRow(r, {revealedOnly}), isMeleeWeapon(), isRangedWeapon()",
    "- Melee: only target enemies in currentFrontRowR()",
    "- Ranged: can hit revealed anywhere; apply RANGED_MULTIPLIER=0.8",
    "- Initial reveal: 2–3 enemies, ≥1 in front row, others behind",
    "- Progressive reveal: when front is cleared, reveal one behind (prefer neighbor of kill)",
    "- Logs: [Hex] initial reveal, melee blocked, reveal behind",
    "Acceptance tests similar to the list above."
  ].join('\n');

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.2,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user }
        ]
      })
    });

    if (!res.ok) {
      console.error("OpenAI error:", await res.text());
      return null;
    }
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content?.trim();
    return text || null;
  } catch (e) {
    console.error("Failed to call OpenAI:", e);
    return null;
  }
}

(async () => {
  const mech = readFileSafe(mechPath, "# MECHANICS\n\n(Describe your rules here)");
  let md = await callOpenAI(mech);
  if (!md) {
    md = heuristicTodo(mech);
  } else if (!md.toLowerCase().includes('# todo')) {
    md = `# TODO\n\n${md}`;
  }
  writeFile(todoPath, md);
  console.log("Wrote", todoPath);
})();
