import { callTextJson } from './anthropicClient.js';

const SYSTEM_PROMPT = `You will be given a list of design findings, each with only a
description and a suggestion. You will NOT be told which framework or
principle produced each finding. Score each one for severity based
entirely on its likely impact on a user completing a task - never on
how the finding is phrased or how confidently it's written.

SEVERITY RUBRIC:
- "critical" - blocks or seriously confuses the primary task; a typical
  user would likely fail or abandon the task because of this
- "moderate" - adds friction or hesitation, but a workaround or
  recovery path exists; the user probably still completes the task
- "minor" - a polish, consistency, or craft note; does not meaningfully
  affect task completion

RULES:
- Judge only the finding text and suggestion you're given - nothing else.
- Do not infer or guess what framework a finding might have come from.
- If two findings describe similar-looking problems, they should get
  similar severity - consistency across the list matters.
- Return exactly one severity per finding, matched by id.

OUTPUT - strict JSON, no prose outside the JSON:
{
  "scores": [
    { "id": "string, matches input id", "severity": "critical" | "moderate" | "minor" }
  ]
}`;

/**
 * @param {Array<{id: string, finding: string, suggestion: string}>} strippedFindings
 *   - must NOT include source/principle fields, by design
 * @returns {Promise<Array<{id: string, severity: string}>>}
 */
export async function scoreSeverity(strippedFindings) {
  if (strippedFindings.length === 0) return [];
  const result = await callTextJson({
    systemPrompt: SYSTEM_PROMPT,
    userText: JSON.stringify({ findings: strippedFindings }),
  });
  if (!Array.isArray(result.scores)) {
    throw new Error('Severity re-scorer did not return a scores array');
  }
  return result.scores;
}
