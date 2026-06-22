import sharp from 'sharp';

const WCAG_LARGE_TEXT_RATIO = 3.0;
const WCAG_NORMAL_TEXT_RATIO = 4.5;
const LARGE_TEXT_HEIGHT_PX = 24; // proxy for "large text" since real font size isn't available from a screenshot

// Validity gates for trusting a window's k-means split as a real text/background separation.
// These were tuned against real pixel data from a gradient hero banner - without them,
// windows containing no text at all report fake low-contrast "failures" on pure background.
const MIN_TEXT_FRACTION = 0.06;
const MAX_TEXT_FRACTION = 0.55;
const MAX_FG_VARIANCE = 800;

function relativeLuminance([r, g, b]) {
  const lin = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

function contrastRatio(rgbA, rgbB) {
  const L1 = relativeLuminance(rgbA);
  const L2 = relativeLuminance(rgbB);
  const lighter = Math.max(L1, L2);
  const darker = Math.min(L1, L2);
  return (lighter + 0.05) / (darker + 0.05);
}

function dist(a, b) {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
}

function mean(pixels) {
  const sum = [0, 0, 0];
  for (const p of pixels) { sum[0] += p[0]; sum[1] += p[1]; sum[2] += p[2]; }
  return sum.map((s) => s / pixels.length);
}

function variance(pixels, center) {
  let total = 0;
  for (const p of pixels) total += dist(p, center) ** 2;
  return total / pixels.length;
}

function kmeans2(pixels, iterations = 10) {
  let c1 = pixels[0];
  let c2 = pixels[pixels.length - 1];
  let g1 = [];
  let g2 = [];
  for (let i = 0; i < iterations; i++) {
    g1 = []; g2 = [];
    for (const p of pixels) (dist(p, c1) <= dist(p, c2) ? g1 : g2).push(p);
    if (g1.length) c1 = mean(g1);
    if (g2.length) c2 = mean(g2);
  }
  const [fg, bg, gfg, gbg] = g1.length < g2.length ? [c1, c2, g1, g2] : [c2, c1, g2, g1];
  return { fg, bg, gfg, gbg };
}

function toHex([r, g, b]) {
  return `#${[r, g, b].map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Computes the worst-case (lowest) contrast ratio across a text region by sliding
 * a window across it - necessary because a gradient/busy background can have very
 * different contrast under different parts of the same line of text.
 * @param {Buffer} rawPixelData - raw RGB pixel buffer for the cropped region
 * @param {number} width
 * @param {number} height
 * @returns {{ratio: number, foreground: string, background: string} | null}
 */
function computeWorstCaseContrast(rawPixelData, width, height) {
  const allPixels = [];
  for (let i = 0; i < rawPixelData.length; i += 3) {
    allPixels.push([rawPixelData[i], rawPixelData[i + 1], rawPixelData[i + 2]]);
  }
  // pixels are row-major; reshape access by column-window across full height
  const windowWidth = Math.max(20, Math.floor(width * 0.2));
  const step = Math.floor(windowWidth / 2) || 1;

  let worst = null;
  for (let wx = 0; wx + windowWidth <= width; wx += step) {
    const windowPixels = [];
    for (let y = 0; y < height; y++) {
      for (let x = wx; x < wx + windowWidth; x++) {
        const idx = y * width + x;
        windowPixels.push(allPixels[idx]);
      }
    }
    const { fg, bg, gfg } = kmeans2(windowPixels);
    const fraction = gfg.length / windowPixels.length;
    const fgVariance = gfg.length ? variance(gfg, fg) : Infinity;
    const valid = fraction >= MIN_TEXT_FRACTION && fraction <= MAX_TEXT_FRACTION && fgVariance <= MAX_FG_VARIANCE;
    if (!valid) continue;

    const ratio = contrastRatio(fg, bg);
    if (!worst || ratio < worst.ratio) {
      worst = { ratio, foreground: toHex(fg), background: toHex(bg) };
    }
  }
  return worst;
}

/**
 * @param {Buffer} imageBuffer - full screenshot
 * @param {Array} regions - regions of type "text" from detectRegions()
 * @returns {Promise<Array>} ComplianceFinding[] for WCAG 1.4.3, one per text region with a valid measurement
 */
export async function computeContrast(imageBuffer, regions) {
  const textRegions = regions.filter((r) => r.type === 'text');
  const findings = [];

  for (const region of textRegions) {
    const { data } = await sharp(imageBuffer)
      .extract({ left: region.x, top: region.y, width: region.width, height: region.height })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const result = computeWorstCaseContrast(data, region.width, region.height);
    if (!result) continue; // no window passed the validity gates - not enough info to measure

    const required = region.height >= LARGE_TEXT_HEIGHT_PX ? WCAG_LARGE_TEXT_RATIO : WCAG_NORMAL_TEXT_RATIO;
    findings.push({
      id: `contrast-${region.id}`,
      criterion: 'WCAG 1.4.3 — Contrast (Minimum)',
      status: result.ratio >= required ? 'pass' : 'fail',
      regionId: region.id,
      detail: `Measured contrast ratio ${result.ratio.toFixed(2)}:1 against a required ${required}:1.`,
      computed: {
        foreground: result.foreground,
        background: result.background,
        ratio: Number(result.ratio.toFixed(2)),
        required,
      },
    });
  }
  return findings;
}
