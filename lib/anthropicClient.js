import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/**
 * Strips markdown code fences a model sometimes wraps JSON in, then parses.
 * Throws with the raw text included so failures are debuggable, not silent.
 */
function parseJsonResponse(text) {
  const cleaned = text.replace(/```json\s*|```\s*/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch (err) {
    throw new Error(`Failed to parse model JSON response: ${err.message}\nRaw: ${cleaned.slice(0, 500)}`);
  }
}

/**
 * Sends a single-turn vision + text prompt and returns parsed JSON.
 * @param {string} systemPrompt
 * @param {Buffer} imageBuffer
 * @param {string} userText - additional context (e.g. region list) appended after the image
 */
export async function callVisionJson({ systemPrompt, imageBuffer, userText, mediaType = 'image/png' }) {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2000,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBuffer.toString('base64') } },
          { type: 'text', text: userText },
        ],
      },
    ],
  });
  const text = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n');
  return parseJsonResponse(text);
}

/**
 * Sends a text-only prompt (used by the severity re-scorer, which never sees the image
 * or the source/principle fields — only the finding text itself).
 */
export async function callTextJson({ systemPrompt, userText }) {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1500,
    system: systemPrompt,
    messages: [{ role: 'user', content: userText }],
  });
  const text = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n');
  return parseJsonResponse(text);
}
