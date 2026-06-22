const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('file-input');
const previewArea = document.getElementById('preview-area');
const previewImg = document.getElementById('preview-img');
const analyzeBtn = document.getElementById('analyze-btn');
const resetBtn = document.getElementById('reset-btn');
const uploadSection = document.getElementById('upload-section');
const loadingSection = document.getElementById('loading-section');
const traceLog = document.getElementById('trace-log');
const errorSection = document.getElementById('error-section');
const errorMessage = document.getElementById('error-message');
const errorResetBtn = document.getElementById('error-reset-btn');
const resultsSection = document.getElementById('results-section');
const judgmentList = document.getElementById('judgment-list');
const complianceList = document.getElementById('compliance-list');
const severitySummary = document.getElementById('severity-summary');
const statusSummary = document.getElementById('status-summary');
const metaSection = document.getElementById('meta-section');
const metaText = document.getElementById('meta-text');
const runAnotherBtn = document.getElementById('run-another-btn');

let currentBase64 = null;
let traceInterval = null;

// --- Tab switching ---

document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach((p) => p.classList.add('hidden'));
    btn.classList.add('active');
    document.getElementById(`tab-${btn.dataset.tab}`).classList.remove('hidden');
  });
});

// --- Upload handling ---

dropzone.addEventListener('click', () => fileInput.click());

['dragover', 'dragenter'].forEach((evt) =>
  dropzone.addEventListener(evt, (e) => { e.preventDefault(); dropzone.classList.add('drag-over'); })
);
['dragleave', 'drop'].forEach((evt) =>
  dropzone.addEventListener(evt, (e) => { e.preventDefault(); dropzone.classList.remove('drag-over'); })
);
dropzone.addEventListener('drop', (e) => {
  const file = e.dataTransfer.files[0];
  if (file) handleFile(file);
});

fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) handleFile(file);
});

function handleFile(file) {
  if (!file.type.startsWith('image/')) {
    showError('That file is not an image. Drop a PNG or JPG screenshot.');
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    const dataUrl = reader.result;
    currentBase64 = dataUrl.split(',')[1];
    previewImg.src = dataUrl;
    dropzone.classList.add('hidden');
    previewArea.classList.remove('hidden');
  };
  reader.readAsDataURL(file);
}

resetBtn.addEventListener('click', resetToUpload);
runAnotherBtn.addEventListener('click', resetToUpload);
errorResetBtn.addEventListener('click', resetToUpload);

function resetToUpload() {
  currentBase64 = null;
  fileInput.value = '';
  previewArea.classList.add('hidden');
  dropzone.classList.remove('hidden');
  uploadSection.classList.remove('hidden');
  loadingSection.classList.add('hidden');
  errorSection.classList.add('hidden');
  resultsSection.classList.add('hidden');
  metaSection.classList.add('hidden');
  if (traceInterval) clearInterval(traceInterval);
  document.querySelectorAll('.tab-btn').forEach((b, i) => b.classList.toggle('active', i === 0));
  document.querySelectorAll('.tab-panel').forEach((p, i) => p.classList.toggle('hidden', i !== 0));
}

// --- Analysis ---

analyzeBtn.addEventListener('click', runAnalysis);

const TRACE_STEPS = [
  'detecting regions...',
  'running judgment agent (laws of ux + nielsen + house rules)...',
  'running compliance agent (wcag, model-inferred checks)...',
  'computing contrast ratios (deterministic, pixel-sampled)...',
  'scoring severity (blind re-scoring pass)...',
  'cropping region thumbnails...',
];

function startTraceLog() {
  traceLog.textContent = '';
  let lines = [];
  let step = 0;
  traceInterval = setInterval(() => {
    if (step < TRACE_STEPS.length) {
      lines = lines.map((l) => l.replace('> ', '> ✓ ').replace('class="active"', 'class="done"'));
      lines.push(`> ${TRACE_STEPS[step]}`);
      traceLog.innerHTML = lines.map((l, i) =>
        i === lines.length - 1 ? `<span class="active">${l}</span>` : `<span class="done">${l.replace('> ', '> ✓ ')}</span>`
      ).join('\n');
      step++;
    }
  }, 900);
}

function stopTraceLog() {
  if (traceInterval) clearInterval(traceInterval);
  const lines = traceLog.querySelectorAll('span');
  lines.forEach((l) => { l.className = 'done'; if (!l.textContent.includes('✓')) l.textContent = l.textContent.replace('> ', '> ✓ '); });
}

async function runAnalysis() {
  uploadSection.classList.add('hidden');
  resultsSection.classList.add('hidden');
  errorSection.classList.add('hidden');
  metaSection.classList.add('hidden');
  loadingSection.classList.remove('hidden');
  startTraceLog();

  try {
    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: currentBase64 }),
    });
    const data = await response.json();
    stopTraceLog();

    if (!response.ok) {
      throw new Error(data.detail || data.error || 'Analysis failed');
    }

    renderResults(data);
    loadingSection.classList.add('hidden');
    resultsSection.classList.remove('hidden');
    metaSection.classList.remove('hidden');
    metaText.textContent = `${data.meta?.regionsDetected ?? '?'} regions detected · ${data.meta?.processingTimeMs ?? '?'}ms`;
  } catch (err) {
    stopTraceLog();
    loadingSection.classList.add('hidden');
    showError(err.message);
  }
}

function showError(message) {
  errorMessage.textContent = `error: ${message}`;
  errorSection.classList.remove('hidden');
}

// --- Rendering ---

function renderResults(data) {
  const judgment = data.judgment || [];
  const compliance = data.compliance || [];

  renderSeveritySummary(judgment);
  renderStatusSummary(compliance);

  judgmentList.innerHTML = judgment.length
    ? judgment.map(renderJudgmentCard).join('')
    : '<div class="empty-state">no design judgment findings</div>';

  complianceList.innerHTML = compliance.length
    ? compliance.map(renderComplianceCard).join('')
    : '<div class="empty-state">no compliance findings</div>';
}

function renderSeveritySummary(findings) {
  const counts = { critical: 0, moderate: 0, minor: 0 };
  findings.forEach((f) => { if (counts[f.severity] !== undefined) counts[f.severity]++; });
  severitySummary.innerHTML = `
    <span class="summary-pill badge-critical">${counts.critical} critical</span>
    <span class="summary-pill badge-moderate">${counts.moderate} moderate</span>
    <span class="summary-pill badge-minor">${counts.minor} minor</span>
  `;
}

function renderStatusSummary(findings) {
  const counts = { pass: 0, fail: 0, 'needs-review': 0 };
  findings.forEach((f) => { if (counts[f.status] !== undefined) counts[f.status]++; });
  statusSummary.innerHTML = `
    <span class="summary-pill badge-pass">${counts.pass} pass</span>
    <span class="summary-pill badge-fail">${counts.fail} fail</span>
    <span class="summary-pill badge-needs-review">${counts['needs-review']} needs review</span>
  `;
}

const SOURCE_LABELS = {
  'laws-of-ux': 'laws of ux',
  nielsen: "nielsen's heuristics",
  'house-rules': 'house rule (opinion)',
};

function renderJudgmentCard(f) {
  const sourceLabel = SOURCE_LABELS[f.source] || f.source;
  return `
    <div class="finding-card">
      ${f.thumbnail ? `<img src="${f.thumbnail}" alt="${escapeHtml(f.principle)} region" />` : ''}
      <div class="finding-top-row">
        <div>
          <div class="finding-principle">${escapeHtml(f.principle)}</div>
          <div class="finding-source-tag">${escapeHtml(sourceLabel)}</div>
        </div>
        <span class="badge badge-${f.severity}">${escapeHtml(f.severity)}</span>
      </div>
      <p class="finding-text">${escapeHtml(f.finding)}</p>
      <p class="finding-suggestion">${escapeHtml(f.suggestion)}</p>
    </div>
  `;
}

function renderComplianceCard(f) {
  const computedHtml = f.computed ? `
    <div class="contrast-swatches">
      <span class="swatch" style="background:${f.computed.foreground}"></span>
      <span class="swatch" style="background:${f.computed.background}"></span>
      <span>${f.computed.ratio}:1 measured &middot; ${f.computed.required}:1 required</span>
    </div>
  ` : '';
  return `
    <div class="finding-card">
      ${f.thumbnail ? `<img src="${f.thumbnail}" alt="${escapeHtml(f.criterion)} region" />` : ''}
      <div class="finding-top-row">
        <div class="finding-principle">${escapeHtml(f.criterion)}</div>
        <span class="badge badge-${f.status}">${escapeHtml(f.status)}</span>
      </div>
      <p class="finding-text">${escapeHtml(f.detail)}</p>
      ${computedHtml}
    </div>
  `;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}
