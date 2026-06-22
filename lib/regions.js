import { callVisionJson } from './anthropicClient.js';

const SYSTEM_PROMPT = `You are detecting UI regions in a screenshot for downstream critique
agents to reference. Identify distinct regions: text blocks, buttons,
icons, images, and containers. For each, provide a label and pixel
bounding box.

OUTPUT - strict JSON, no prose outside the JSON:
{
  "regions": [
    { "id": "kebab-case-id", "label": "string", "type": "text"|"button"|"icon"|"image"|"container",
      "x": number, "y": number, "width": number, "height": number }
  ]
}`;

/**
 * @param {Buffer} imageBuffer
 * @returns {Promise<Array<{id, label, type, x, y, width, height}>>}
 */
export async function detectRegions(imageBuffer) {
  const result = await callVisionJson({
    systemPrompt: SYSTEM_PROMPT,
    imageBuffer,
    userText: 'Detect all distinct UI regions in this screenshot.',
  });
  if (!Array.isArray(result.regions)) {
    throw new Error('Region detection did not return a regions array');
  }
  return result.regions;
}
