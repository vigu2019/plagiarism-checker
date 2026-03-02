/* ─── State ──────────────────────────────────────────────── */
let currentTab = 'file';       // 'file' | 'text' | 'online'
let onlineInputMode = 'file';  // 'file' | 'text' (within online tab)

/* ─── Tab Switching ──────────────────────────────────────── */
function switchTab(mode) {
    currentTab = mode;
    ['file', 'text', 'online'].forEach(t => {
        document.getElementById(`panel-${t}`).classList.toggle('hidden', t !== mode);
        document.getElementById(`tab-${t}`).classList.toggle('active', t === mode);
    });

    // Adjust button label & style
    const btn = document.getElementById('checkBtn');
    const btnText = document.getElementById('btnText');
    if (mode === 'online') {
        btnText.textContent = 'Check Against Web';
        btn.classList.add('online-mode');
    } else {
        btnText.textContent = 'Check Plagiarism';
        btn.classList.remove('online-mode');
    }
    hideError(); hideResults(); hideOnlineResults();
}

/* ─── Online input sub-toggle (file vs paste) ────────────── */
function switchOnlineInput(mode) {
    onlineInputMode = mode;
    document.getElementById('online-file-zone').classList.toggle('hidden', mode !== 'file');
    document.getElementById('online-text-zone').classList.toggle('hidden', mode !== 'text');
    document.getElementById('otab-file').classList.toggle('active', mode === 'file');
    document.getElementById('otab-text').classList.toggle('active', mode === 'text');
}

/* ─── File Truncation ────────────────────────────────────── */
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
        nameEl.title = file.name;
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

/* ─── Drag & Drop ────────────────────────────────────────── */
function setupDragDrop(dropId, inputId, nameId) {
    const drop = document.getElementById(dropId);
    const input = document.getElementById(inputId);
    drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('drag-over'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('drag-over'));
    drop.addEventListener('drop', e => {
        e.preventDefault(); drop.classList.remove('drag-over');
        const file = e.dataTransfer.files[0];
        if (file) {
            const dt = new DataTransfer(); dt.items.add(file);
            input.files = dt.files;
            handleFileSelect(input, nameId, dropId);
        }
    });
}

setupDragDrop('drop1', 'file1', 'name1');
setupDragDrop('drop2', 'file2', 'name2');
setupDragDrop('drop-online', 'file-online', 'name-online');

/* ─── Word Counters ──────────────────────────────────────── */
['text1', 'text2', 'text-online'].forEach((id, i) => {
    const countIds = ['wc1', 'wc2', 'wc-online'];
    document.getElementById(id).addEventListener('input', function () {
        const words = this.value.trim() === '' ? 0 : this.value.trim().split(/\s+/).length;
        document.getElementById(countIds[i]).textContent = words + ' word' + (words === 1 ? '' : 's');
    });
});

/* ─── Main dispatcher ────────────────────────────────────── */
function handleCheck() {
    if (currentTab === 'online') {
        runOnlineCheck();
    } else {
        runCheck();
    }
}

/* ─── Two-doc Compare ────────────────────────────────────── */
async function runCheck() {
    hideError(); hideResults(); hideOnlineResults();
    const { btn, btnText, spinner } = setLoading(true, 'Analyzing...');

    const formData = new FormData();
    formData.append('mode', currentTab);

    if (currentTab === 'file') {
        const f1 = document.getElementById('file1').files[0];
        const f2 = document.getElementById('file2').files[0];
        if (!f1 || !f2) { showError('Please upload both files.'); setLoading(false); return; }
        formData.append('file1', f1);
        formData.append('file2', f2);
    } else {
        const t1 = document.getElementById('text1').value.trim();
        const t2 = document.getElementById('text2').value.trim();
        if (!t1 || !t2) { showError('Please fill in both text fields.'); setLoading(false); return; }
        formData.append('text1', t1);
        formData.append('text2', t2);
    }

    try {
        const res = await fetch('/check', { method: 'POST', body: formData });
        const data = await res.json();
        if (!res.ok || data.error) { showError(data.error || 'Something went wrong.'); return; }
        renderResults(data);
    } catch (e) {
        showError('Network error — is the server running?');
    } finally {
        setLoading(false);
    }
}

/* ─── Online Check ───────────────────────────────────────── */
async function runOnlineCheck() {
    hideError(); hideResults(); hideOnlineResults();
    const { btn, btnText, spinner } = setLoading(true, 'Searching the web…');

    const formData = new FormData();
    formData.append('mode', onlineInputMode);

    if (onlineInputMode === 'file') {
        const f = document.getElementById('file-online').files[0];
        if (!f) { showError('Please upload a file first.'); setLoading(false); return; }
        formData.append('file1', f);
    } else {
        const t = document.getElementById('text-online').value.trim();
        if (!t) { showError('Please paste some text first.'); setLoading(false); return; }
        formData.append('text1', t);
    }

    try {
        const res = await fetch('/check-online', { method: 'POST', body: formData });
        const data = await res.json();
        if (!res.ok || data.error) { showError(data.error || 'Something went wrong.'); return; }
        renderOnlineResults(data);
    } catch (e) {
        showError('Network error — is the server running?');
    } finally {
        setLoading(false, 'Check Against Web');
    }
}

/* ─── Render two-doc results ─────────────────────────────── */
function renderResults(data) {
    const section = document.getElementById('resultsSection');
    section.classList.remove('hidden');
    animateRing(data.similarity, data.color);

    document.getElementById('scoreText').textContent = data.similarity + '%';
    document.getElementById('scoreText').style.color = colorVar(data.color);
    const badge = document.getElementById('labelBadge');
    badge.textContent = data.label;
    badge.className = 'label-badge ' + data.color;
    document.getElementById('wc1Result').textContent = data.word_count_1 + ' words';
    document.getElementById('wc2Result').textContent = data.word_count_2 + ' words';

    const descs = {
        high: '⚠️ Strong evidence of plagiarism — substantial overlapping content detected.',
        medium: '🔶 Moderate overlap found — some passages are highly similar.',
        low: '✅ Low similarity — minor overlaps, likely coincidental.',
        minimal: '🟢 Virtually no similarity — documents appear original and distinct.'
    };
    document.getElementById('scoreDesc').textContent = descs[data.color] || '';

    const list = document.getElementById('matchesList');
    list.innerHTML = '';
    document.getElementById('matchCount').textContent = data.pairs.length + ' match' + (data.pairs.length === 1 ? '' : 'es');

    if (data.pairs.length === 0) {
        list.innerHTML = '<p style="color:var(--muted);font-size:0.9rem;">No sentence-level matches above the threshold.</p>';
    } else {
        data.pairs.forEach((pair, i) => {
            const cls = pair.score >= 80 ? 'high' : pair.score >= 55 ? 'medium' : 'low';
            const barColor = cls === 'high' ? 'var(--high)' : cls === 'medium' ? 'var(--medium)' : 'var(--low)';
            const item = document.createElement('div');
            item.className = 'match-item';
            item.style.animationDelay = (i * 0.05) + 's';
            item.innerHTML = `
                <div class="match-score-row">
                    <span class="match-score-badge ${cls}">${pair.score}% Match</span>
                    <div class="match-bar-wrap"><div class="match-bar" style="width:0%;background:${barColor}" data-w="${pair.score}%"></div></div>
                </div>
                <p class="sentence-label">Document 1</p>
                <p class="sentence-text">${escapeHtml(pair.s1)}</p>
                <hr class="sentence-divider"/>
                <p class="sentence-label">Document 2</p>
                <p class="sentence-text">${escapeHtml(pair.s2)}</p>`;
            list.appendChild(item);
        });
        requestAnimationFrame(() => {
            document.querySelectorAll('.match-bar').forEach(b => { b.style.width = b.dataset.w; });
        });
    }
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ─── Render online results ──────────────────────────────── */
function renderOnlineResults(data) {
    const section = document.getElementById('onlineResultsSection');
    section.classList.remove('hidden');

    // Summary bar
    const topScore = data.sources.length ? data.sources[0].similarity : 0;
    const topColor = topScore >= 80 ? 'var(--high)' : topScore >= 50 ? 'var(--medium)' : 'var(--low)';
    document.getElementById('onlineSummaryBar').innerHTML = `
        <div class="online-stat"><span class="online-stat-label">URLs Searched</span><span class="online-stat-val">${data.total_searched}</span></div>
        <div class="online-stat"><span class="online-stat-label">Matches Found</span><span class="online-stat-val">${data.total_matched}</span></div>
        <div class="online-stat"><span class="online-stat-label">Highest Match</span><span class="online-stat-val" style="color:${topColor}">${topScore}%</span></div>
        <div class="online-stat"><span class="online-stat-label">Your Doc Words</span><span class="online-stat-val">${data.word_count}</span></div>
    `;

    // Source cards
    const list = document.getElementById('sourcesList');
    list.innerHTML = '';

    if (data.sources.length === 0) {
        list.innerHTML = '<div class="no-sources">🎉 No significant matches found on the web. Your document appears original!</div>';
    } else {
        data.sources.forEach((src, i) => {
            const hostname = (() => { try { return new URL(src.url).hostname; } catch (e) { return src.url; } })();
            const faviconUrl = `https://www.google.com/s2/favicons?sz=16&domain=${hostname}`;
            const barColor = src.color === 'high' ? 'var(--high)' : src.color === 'medium' ? 'var(--medium)' : src.color === 'low' ? 'var(--low)' : 'var(--minimal)';

            let pairsHtml = '';
            if (src.pairs && src.pairs.length > 0) {
                pairsHtml = src.pairs.map(p => `
                    <div class="match-item" style="margin-top:10px;animation:none">
                        <div class="match-score-row">
                            <span class="match-score-badge ${p.score >= 80 ? 'high' : p.score >= 55 ? 'medium' : 'low'}">${p.score}% Match</span>
                            <div class="match-bar-wrap"><div class="match-bar" style="width:${p.score}%;background:${p.score >= 80 ? 'var(--high)' : p.score >= 55 ? 'var(--medium)' : 'var(--low)'}"></div></div>
                        </div>
                        <p class="sentence-label">Your Text</p>
                        <p class="sentence-text">${escapeHtml(p.s1)}</p>
                        <hr class="sentence-divider"/>
                        <p class="sentence-label">Found Online</p>
                        <p class="sentence-text">${escapeHtml(p.s2)}</p>
                    </div>`).join('');
            }

            const card = document.createElement('div');
            card.className = 'source-card';
            card.style.animationDelay = (i * 0.06) + 's';
            card.innerHTML = `
                <div class="source-card-header">
                    <span class="source-score-badge ${src.color}">${src.similarity}%</span>
                    <div class="source-url-bar">
                        <img class="source-favicon" src="${faviconUrl}" onerror="this.style.display='none'" alt=""/>
                        <a class="source-url" href="${escapeHtml(src.url)}" target="_blank" rel="noopener" title="${escapeHtml(src.url)}">${escapeHtml(hostname)}</a>
                    </div>
                    <span class="label-badge ${src.color}" style="font-size:0.75rem;padding:4px 12px">${src.label}</span>
                </div>
                <div class="source-bar-row">
                    <div class="source-bar-wrap"><div class="source-bar" style="width:${src.similarity}%;background:${barColor}"></div></div>
                    <span style="font-size:0.78rem;color:var(--muted);white-space:nowrap">${src.similarity}% similar</span>
                </div>
                ${src.pairs && src.pairs.length ? `
                <details class="source-sentences">
                    <summary>▶ Show ${src.pairs.length} matching sentence${src.pairs.length > 1 ? 's' : ''}</summary>
                    ${pairsHtml}
                </details>` : ''}
            `;
            list.appendChild(card);
        });
    }
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ─── SVG Ring ───────────────────────────────────────────── */
function animateRing(pct, colorClass) {
    const circumference = 314;
    const offset = circumference - (pct / 100) * circumference;
    const fill = document.getElementById('ringFill');
    const svg = fill.closest('svg');
    let defs = svg.querySelector('defs');
    if (!defs) { defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs'); svg.appendChild(defs); }
    const colors = { high: ['#ff5c7a', '#ff8099'], medium: ['#ffb347', '#ffd080'], low: ['#3ecf8e', '#72e8b8'], minimal: ['#48c6ef', '#8ef0ff'] };
    const [c1, c2] = colors[colorClass] || colors.minimal;
    defs.innerHTML = `<linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="${c1}"/><stop offset="100%" stop-color="${c2}"/></linearGradient>`;
    fill.style.transition = 'none';
    fill.style.strokeDashoffset = circumference;
    requestAnimationFrame(() => {
        fill.style.transition = 'stroke-dashoffset 1.2s cubic-bezier(.16,1,.3,1)';
        fill.style.strokeDashoffset = offset;
    });
}

/* ─── Helpers ────────────────────────────────────────────── */
function setLoading(on, label) {
    const btn = document.getElementById('checkBtn');
    const btnText = document.getElementById('btnText');
    const spinner = document.getElementById('spinner');
    btn.disabled = on;
    if (label) btnText.textContent = label;
    spinner.classList.toggle('hidden', !on);
    return { btn, btnText, spinner };
}

function colorVar(cls) {
    const m = { high: '#ff5c7a', medium: '#ffb347', low: '#3ecf8e', minimal: '#48c6ef' };
    return m[cls] || '#fff';
}

function showError(msg) {
    const box = document.getElementById('errorBox');
    box.textContent = '⚠️ ' + msg;
    box.classList.remove('hidden');
}
function hideError() { document.getElementById('errorBox').classList.add('hidden'); }
function hideResults() { document.getElementById('resultsSection').classList.add('hidden'); }
function hideOnlineResults() { document.getElementById('onlineResultsSection').classList.add('hidden'); }

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
