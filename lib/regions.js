import { callVisionJson } from './anthropicClient.js';

const SYSTEM_PROMPT = `You are detecting UI regions in a screenshot for downstream critique
agents to reference. Identify distinct regions: text blocks, buttons,
icons, images, and containers. For each, provide a label and pixel
bounding box.

CONSOLIDATE REPETITIVE ELEMENTS: If the screenshot contains a list or
row of visually similar repeated items (e.g. a column of server icons,
a grid of avatar thumbnails, a list of nav items), do NOT create one
region per item. Instead, create ONE container region for the whole
group (e.g. "left-icon-rail") and only break out individual items if
they are genuinely distinct in function (e.g. the one currently
selected/active item). This keeps output concise on dense UIs.

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
    maxTokens: 4096,
  });
  if (!Array.isArray(result.regions)) {
    throw new Error('Region detection did not return a regions array');
  }
  return result.regions;
}
