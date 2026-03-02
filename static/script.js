/* ─── Tab Switching ───────────────────────────────────── */
let currentMode = 'file';

function switchTab(mode) {
    currentMode = mode;
    document.getElementById('panel-file').classList.toggle('hidden', mode !== 'file');
    document.getElementById('panel-text').classList.toggle('hidden', mode !== 'text');
    document.getElementById('tab-file').classList.toggle('active', mode === 'file');
    document.getElementById('tab-text').classList.toggle('active', mode === 'text');
    hideResults();
}

/* ─── File Select Display ────────────────────────────── */
/* Truncate a long filename: keep first 22 chars + "…" + extension */
function truncateFilename(name, maxLen = 22) {
    const dot = name.lastIndexOf('.');
    const ext = dot !== -1 ? name.slice(dot) : '';
    const base = dot !== -1 ? name.slice(0, dot) : name;
    if (base.length <= maxLen) return name;
    return base.slice(0, maxLen) + '…' + ext;
}

function handleFileSelect(input, nameId, dropId) {
    const file = input.files[0];
    const nameEl = document.getElementById(nameId);
    const dropEl = document.getElementById(dropId);
    if (file) {
        nameEl.textContent = '✓ ' + truncateFilename(file.name);
        nameEl.title = file.name;          /* full name on hover */
        nameEl.style.color = '#48c6ef';
        dropEl.style.borderColor = '#6c63ff';
        dropEl.style.background = 'rgba(108,99,255,0.08)';
    } else {
        nameEl.textContent = 'No file chosen';
        nameEl.title = '';
        nameEl.style.color = '';
        dropEl.style.borderColor = '';
        dropEl.style.background = '';
    }
}

/* ─── Drag & Drop ────────────────────────────────────── */
function setupDragDrop(dropId, inputId, nameId) {
    const drop = document.getElementById(dropId);
    const input = document.getElementById(inputId);

    drop.addEventListener('dragover', e => {
        e.preventDefault();
        drop.classList.add('drag-over');
    });
    drop.addEventListener('dragleave', () => drop.classList.remove('drag-over'));
    drop.addEventListener('drop', e => {
        e.preventDefault();
        drop.classList.remove('drag-over');
        const file = e.dataTransfer.files[0];
        if (file) {
            const dt = new DataTransfer();
            dt.items.add(file);
            input.files = dt.files;
            handleFileSelect(input, nameId, dropId);
        }
    });
}

setupDragDrop('drop1', 'file1', 'name1');
setupDragDrop('drop2', 'file2', 'name2');

/* ─── Word Counter (Text Mode) ───────────────────────── */
document.getElementById('text1').addEventListener('input', function () {
    updateWordCount(this, 'wc1');
});
document.getElementById('text2').addEventListener('input', function () {
    updateWordCount(this, 'wc2');
});

function updateWordCount(textarea, countId) {
    const words = textarea.value.trim() === '' ? 0 : textarea.value.trim().split(/\s+/).length;
    document.getElementById(countId).textContent = words + ' word' + (words === 1 ? '' : 's');
}

/* ─── Main Check Function ────────────────────────────── */
async function runCheck() {
    hideError();
    hideResults();

    const btn = document.getElementById('checkBtn');
    const btnText = document.getElementById('btnText');
    const spinner = document.getElementById('spinner');

    // Build FormData
    const formData = new FormData();
    formData.append('mode', currentMode);

    if (currentMode === 'file') {
        const f1 = document.getElementById('file1').files[0];
        const f2 = document.getElementById('file2').files[0];
        if (!f1 || !f2) { showError('Please upload both files before checking.'); return; }
        formData.append('file1', f1);
        formData.append('file2', f2);
    } else {
        const t1 = document.getElementById('text1').value.trim();
        const t2 = document.getElementById('text2').value.trim();
        if (!t1 || !t2) { showError('Please paste text in both fields before checking.'); return; }
        formData.append('text1', t1);
        formData.append('text2', t2);
    }

    // Loading state
    btn.disabled = true;
    btnText.textContent = 'Analyzing...';
    spinner.classList.remove('hidden');

    try {
        const res = await fetch('/check', { method: 'POST', body: formData });
        const data = await res.json();

        if (!res.ok || data.error) {
            showError(data.error || 'Something went wrong. Please try again.');
            return;
        }

        renderResults(data);
    } catch (err) {
        showError('Network error. Is the Flask server running?');
    } finally {
        btn.disabled = false;
        btnText.textContent = 'Check Plagiarism';
        spinner.classList.add('hidden');
    }
}

/* ─── Render Results ─────────────────────────────────── */
function renderResults(data) {
    const section = document.getElementById('resultsSection');
    section.classList.remove('hidden');

    // Animate score ring
    animateRing(data.similarity, data.color);

    // Score text
    document.getElementById('scoreText').textContent = data.similarity + '%';
    document.getElementById('scoreText').style.color = colorVar(data.color);

    // Label badge
    const badge = document.getElementById('labelBadge');
    badge.textContent = data.label;
    badge.className = 'label-badge ' + data.color;

    // Meta pills
    document.getElementById('wc1Result').textContent = data.word_count_1 + ' words';
    document.getElementById('wc2Result').textContent = data.word_count_2 + ' words';

    // Description
    const descriptions = {
        high: '⚠️ Strong evidence of plagiarism detected. The documents share substantial overlapping content.',
        medium: '🔶 Moderate overlap found. Some passages appear highly similar — review is recommended.',
        low: '✅ Low similarity. Minor overlapping phrases; likely coincidental or common phrasing.',
        minimal: '🟢 Virtually no similarity detected. The two documents appear to be original and distinct.'
    };
    document.getElementById('scoreDesc').textContent = descriptions[data.color] || '';

    // Sentence matches
    const list = document.getElementById('matchesList');
    list.innerHTML = '';

    document.getElementById('matchCount').textContent = data.pairs.length + ' match' + (data.pairs.length === 1 ? '' : 'es');

    if (data.pairs.length === 0) {
        document.getElementById('matchesSection').style.opacity = '0.5';
        list.innerHTML = '<p style="color:var(--muted);font-size:0.9rem;">No sentence-level matches found above the threshold.</p>';
    } else {
        document.getElementById('matchesSection').style.opacity = '1';
        data.pairs.forEach((pair, i) => {
            const cls = pair.score >= 80 ? 'high' : pair.score >= 55 ? 'medium' : 'low';
            const barColor = cls === 'high' ? 'var(--high)' : cls === 'medium' ? 'var(--medium)' : 'var(--low)';

            const item = document.createElement('div');
            item.className = 'match-item';
            item.style.animationDelay = (i * 0.05) + 's';
            item.innerHTML = `
                <div class="match-score-row">
                    <span class="match-score-badge ${cls}">${pair.score}% Match</span>
                    <div class="match-bar-wrap">
                        <div class="match-bar" style="width:0%;background:${barColor}" data-width="${pair.score}%"></div>
                    </div>
                </div>
                <p class="sentence-label">Document 1</p>
                <p class="sentence-text">${escapeHtml(pair.s1)}</p>
                <hr class="sentence-divider"/>
                <p class="sentence-label">Document 2</p>
                <p class="sentence-text">${escapeHtml(pair.s2)}</p>
            `;
            list.appendChild(item);
        });

        // Animate bars after paint
        requestAnimationFrame(() => {
            document.querySelectorAll('.match-bar').forEach(bar => {
                bar.style.transition = 'width 0.8s ease';
                bar.style.width = bar.dataset.width;
            });
        });
    }

    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ─── SVG Ring Animation ─────────────────────────────── */
function animateRing(pct, colorClass) {
    const circumference = 314; // 2 * π * 50
    const offset = circumference - (pct / 100) * circumference;
    const fill = document.getElementById('ringFill');

    // Inject gradient
    const svg = fill.closest('svg');
    let defs = svg.querySelector('defs');
    if (!defs) {
        defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        svg.appendChild(defs);
    }
    defs.innerHTML = '';

    const colors = {
        high: ['#ff5c7a', '#ff8099'],
        medium: ['#ffb347', '#ffd080'],
        low: ['#3ecf8e', '#72e8b8'],
        minimal: ['#48c6ef', '#8ef0ff']
    };
    const [c1, c2] = colors[colorClass] || colors.minimal;

    defs.innerHTML = `
        <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="${c1}"/>
            <stop offset="100%" stop-color="${c2}"/>
        </linearGradient>
    `;

    // Animate from 314 → offset
    fill.style.transition = 'none';
    fill.style.strokeDashoffset = circumference;
    requestAnimationFrame(() => {
        fill.style.transition = 'stroke-dashoffset 1.2s cubic-bezier(.16,1,.3,1)';
        fill.style.strokeDashoffset = offset;
    });
}

/* ─── Helpers ────────────────────────────────────────── */
function colorVar(cls) {
    const map = { high: '#ff5c7a', medium: '#ffb347', low: '#3ecf8e', minimal: '#48c6ef' };
    return map[cls] || '#fff';
}

function showError(msg) {
    const box = document.getElementById('errorBox');
    box.textContent = '⚠️ ' + msg;
    box.classList.remove('hidden');
}
function hideError() { document.getElementById('errorBox').classList.add('hidden'); }
function hideResults() { document.getElementById('resultsSection').classList.add('hidden'); }

function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
