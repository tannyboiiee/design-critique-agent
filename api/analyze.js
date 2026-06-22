import { detectRegions } from '../lib/regions.js';
import { runJudgmentAgent } from '../lib/judgmentAgent.js';
import { runComplianceModel } from '../lib/complianceAgent.js';
import { computeContrast } from '../lib/contrast.js';
import { scoreSeverity } from '../lib/severityRescorer.js';
import { aggregate } from '../lib/aggregator.js';

export const config = { maxDuration: 60 }; // sequential AI calls need headroom beyond the 10s default

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { image } = req.body;
  if (!image) return res.status(400).json({ error: 'Missing image' });

  const start = Date.now();
  try {
    const imageBuffer = Buffer.from(image, 'base64');

    // Step 1: region detection must finish before anything else can reference regions
    const regions = await detectRegions(imageBuffer);

    // Step 2: judgment + compliance run in parallel - independent, neither needs the other's output
    const [judgmentRaw, complianceModelFindings, contrastFindings] = await Promise.all([
      runJudgmentAgent(imageBuffer, regions),
      runComplianceModel(imageBuffer, regions),
      computeContrast(imageBuffer, regions), // pure code, no model call
    ]);

    // Step 3: blind re-score, stripped of source/principle
    const severityInput = judgmentRaw.map(({ id, finding, suggestion }) => ({ id, finding, suggestion }));
    const severityScores = await scoreSeverity(severityInput);

    // Step 4: merge everything + crop regions to thumbnails
    const result = await aggregate({
      imageBuffer,
      regions,
      judgmentFindings: judgmentRaw,
      severityScores,
      complianceFindings: [...complianceModelFindings, ...contrastFindings],
    });

    res.status(200).json({ ...result, meta: { regionsDetected: regions.length, processingTimeMs: Date.now() - start } });
  } catch (err) {
    console.error('Analysis failed:', err);
    res.status(500).json({ error: 'Analysis failed', detail: err.message });
  }
}
