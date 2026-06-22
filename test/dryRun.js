import fs from 'fs';
import { computeContrast } from '../lib/contrast.js';
import { aggregate } from '../lib/aggregator.js';

const imageBuffer = fs.readFileSync('/mnt/user-data/uploads/1782102593085_image.png');

// Hand-built regions, standing in for detectRegions() output (no API key in this sandbox).
// Coordinates for hero-text taken from the same crop validated against real pixels earlier.
const regions = [
  { id: 'hero-text', label: 'Find Your Community on Daccord', type: 'text', x: 600, y: 165, width: 700, height: 115 },
  { id: 'topright-icons', label: 'Top right icon toolbar', type: 'icon', x: 1450, y: 10, width: 310, height: 50 },
];

// Stub judgment findings - same as the manual stress-test run, minus severity
const judgmentRaw = [
  { id: 'j1', source: 'laws-of-ux', principle: "Fitts's Law", regionId: 'topright-icons',
    finding: 'Icon buttons appear small and tightly spaced, raising mis-tap risk.',
    suggestion: 'Increase target size and spacing.' },
];

const severityScores = [{ id: 'j1', severity: 'moderate' }];

async function main() {
  console.log('Running real computeContrast() against real screenshot pixels...');
  const contrastFindings = await computeContrast(imageBuffer, regions);
  console.log('Contrast findings:', JSON.stringify(contrastFindings, null, 2));

  console.log('\nRunning aggregate() to merge + crop thumbnails...');
  const result = await aggregate({
    imageBuffer,
    regions,
    judgmentFindings: judgmentRaw,
    severityScores,
    complianceFindings: contrastFindings,
  });

  console.log('\nFinal judgment panel (severity attached):');
  console.log(result.judgment.map(({ thumbnail, ...rest }) => ({ ...rest, thumbnail: thumbnail ? `[${thumbnail.length} chars]` : null })));

  console.log('\nFinal compliance panel:');
  console.log(result.compliance.map(({ thumbnail, ...rest }) => ({ ...rest, thumbnail: thumbnail ? `[${thumbnail.length} chars]` : null })));
}

main().catch((err) => { console.error('Dry run failed:', err); process.exit(1); });
