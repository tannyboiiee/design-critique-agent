import sharp from 'sharp';

const THUMBNAIL_PADDING = 12; // small margin around the region so the crop has visual context

async function cropThumbnail(imageBuffer, region, imgWidth, imgHeight) {
  const x = Math.max(0, region.x - THUMBNAIL_PADDING);
  const y = Math.max(0, region.y - THUMBNAIL_PADDING);
  const width = Math.min(imgWidth - x, region.width + THUMBNAIL_PADDING * 2);
  const height = Math.min(imgHeight - y, region.height + THUMBNAIL_PADDING * 2);

  const buffer = await sharp(imageBuffer)
    .extract({ left: x, top: y, width, height })
    .png()
    .toBuffer();
  return `data:image/png;base64,${buffer.toString('base64')}`;
}

/**
 * Merges judgment findings with their re-scored severity, merges all compliance
 * findings, and attaches a cropped thumbnail to every finding in both panels.
 *
 * @param {object} params
 * @param {Buffer} params.imageBuffer
 * @param {Array} params.regions
 * @param {Array} params.judgmentFindings - from runJudgmentAgent(), no severity yet
 * @param {Array} params.severityScores - from scoreSeverity(), {id, severity}[]
 * @param {Array} params.complianceFindings - merged model + contrast findings
 * @returns {Promise<{judgment: Array, compliance: Array}>}
 */
export async function aggregate({ imageBuffer, regions, judgmentFindings, severityScores, complianceFindings }) {
  const meta = await sharp(imageBuffer).metadata();
  const regionsById = Object.fromEntries(regions.map((r) => [r.id, r]));
  const severityById = Object.fromEntries(severityScores.map((s) => [s.id, s.severity]));

  const judgment = await Promise.all(
    judgmentFindings.map(async (finding) => {
      const region = regionsById[finding.regionId];
      const thumbnail = region ? await cropThumbnail(imageBuffer, region, meta.width, meta.height) : null;
      return {
        ...finding,
        severity: severityById[finding.id] ?? 'moderate', // fallback if the rescorer ever misses an id
        thumbnail,
      };
    })
  );

  const compliance = await Promise.all(
    complianceFindings.map(async (finding) => {
      const region = regionsById[finding.regionId];
      const thumbnail = region ? await cropThumbnail(imageBuffer, region, meta.width, meta.height) : null;
      return { ...finding, thumbnail };
    })
  );

  return { judgment, compliance };
}
