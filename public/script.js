const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('vtt-input');
const analyzeBtn = document.getElementById('analyze-btn');
const resultsSection = document.getElementById('results');

let selectedFile = null;
let currentResults = null;
let participationChart = null;
let noiseChart = null;

// Modal elements
const previewModal = document.getElementById('preview-modal');
const closeModal = document.getElementById('close-modal');
const rawPreview = document.getElementById('raw-preview');
const cleanPreview = document.getElementById('clean-preview');
const modalTitle = document.getElementById('modal-title');
const downloadTxtBtn = document.getElementById('download-txt-btn');
const modalDownloadBtn = document.getElementById('modal-download-txt');
let activePreviewData = null;

// Error display helper — avoids blocking alert() calls
const errorMessage = document.getElementById('error-message');
function showError(msg) {
    errorMessage.textContent = msg;
    errorMessage.classList.remove('hidden');
    clearTimeout(showError._timer);
    showError._timer = setTimeout(() => errorMessage.classList.add('hidden'), 5000);
}

// Close modal via button, backdrop click, or Escape key
closeModal.onclick = () => previewModal.classList.add('hidden');
window.onclick = (event) => {
    if (event.target == previewModal) previewModal.classList.add('hidden');
};
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') previewModal.classList.add('hidden');
});

// Global Download
downloadTxtBtn.onclick = () => {
    if (!currentResults) return;
    const globalText = currentResults.map(r => `--- FILE: ${r.filename} ---\n\n${r.preview.clean}`).join('\n\n');
    downloadTxtFile(globalText, 'cleaned_transcripts_batch.txt');
};

// Modal Download
modalDownloadBtn.onclick = () => {
    if (!activePreviewData) return;
    downloadTxtFile(activePreviewData.preview.clean, `${activePreviewData.filename}_cleaned.txt`);
};

function downloadTxtFile(content, filename) {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
}

// Handle file selection via click
dropZone.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', (e) => {
    if (e.target.files.length) {
        handleFileSelect(e.target.files[0]);
    }
});

// Handle Drag and Drop
dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drop-zone--over');
});

['dragleave', 'dragend'].forEach(type => {
    dropZone.addEventListener(type, () => {
        dropZone.classList.remove('drop-zone--over');
    });
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drop-zone--over');
    if (e.dataTransfer.files.length) {
        handleFileSelect(e.dataTransfer.files[0]);
    }
});

function handleFileSelect(file) {
    const name = file.name.toLowerCase();
    if (!name.endsWith('.vtt') && !name.endsWith('.zip')) {
        showError('Please select a .vtt or .zip file.');
        return;
    }
    selectedFile = file;
    document.querySelector('.drop-zone__prompt').textContent = `File selected: ${file.name}`;
    analyzeBtn.disabled = false;
}

// Handle Analysis
analyzeBtn.addEventListener('click', async () => {
    if (!selectedFile) return;

    analyzeBtn.disabled = true;
    analyzeBtn.textContent = 'Analyzing...';

    const filterNoise = document.getElementById('noise-filter-toggle').checked;
    const maxResponseGapSeconds = document.getElementById('max-response-gap').value;
    const formData = new FormData();
    formData.append('vttFile', selectedFile);
    formData.append('filterNoise', filterNoise);
    formData.append('maxResponseGapSeconds', maxResponseGapSeconds);

    const isZip = selectedFile.name.toLowerCase().endsWith('.zip');
    const endpoint = isZip ? '/api/analyze-zip' : '/api/analyze';

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({ error: 'Analysis failed' }));
            throw new Error(errData.error || 'Failed to analyze file');
        }

        if (isZip) {
            const data = await response.json();
            currentResults = data.results;

            const blob = new Blob([data.csv], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = 'analysis.csv';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            
            displayResults(data.globalStats);
            displayGlobalStats(data.globalStats);
            
            const notice = document.createElement('div');
            notice.className = 'participant-card';
            notice.style = 'grid-column: 1/-1; text-align: center; border-color: var(--primary);';
            notice.innerHTML = `<span class="participant-name">Batch Analysis Complete! 🎉</span>
                                <span class="participant-count">Click any file card below to preview the transcription.</span>`;
            document.getElementById('participants-list').prepend(notice);
        } else {
            const stats = await response.json();
            currentResults = [ { filename: selectedFile.name, ...stats } ];
            // Hide global panel for single-file mode
            document.getElementById('global-stats-panel').classList.add('hidden');
            displayResults(stats);
        }
    } catch (err) {
        showError(err.message);
    } finally {
        analyzeBtn.disabled = false;
        analyzeBtn.textContent = 'Analyze Conversation';
    }
});

function displayResults(stats) {
    resultsSection.classList.remove('hidden');

    document.getElementById('total-time-min').textContent = stats.durationMinutes;
    document.getElementById('total-time-sec').textContent = stats.durationSeconds;
    document.getElementById('participant-count').textContent = stats.participantCount;
    document.getElementById('total-messages').textContent = stats.totalMessages;
    document.getElementById('total-wpm').textContent = stats.wpm || '0';
    document.getElementById('interruption-count').textContent = stats.interruptionCount || '0';
    
    const mrtElem = document.getElementById('mean-response-time');
    if (mrtElem) {
        mrtElem.textContent = stats.meanResponseTimeSeconds !== undefined ? stats.meanResponseTimeSeconds : '0';
    }

    const noiseRatioElem = document.getElementById('noise-ratio');
    if (noiseRatioElem) {
        noiseRatioElem.textContent = stats.noiseRatio !== undefined ? stats.noiseRatio : '0';
    }

    const noiseCountElem = document.getElementById('noise-count');
    if (noiseCountElem) {
        noiseCountElem.textContent = stats.noiseMessagesCount !== undefined ? stats.noiseMessagesCount : '0';
    }

    const backchannelElem = document.getElementById('backchannel-count');
    if (backchannelElem) {
        backchannelElem.textContent = stats.backchannelCount !== undefined ? stats.backchannelCount : '0';
    }

    // Render Visuals
    if (window.Chart) {
        try {
            renderParticipationChart(stats.participants);
            renderNoiseChart(stats.noiseBreakdown);
        } catch (e) {
            console.error('Charting error:', e);
        }
    }

    const equalityElem = document.getElementById('equality-score');
    if (equalityElem) {
        equalityElem.textContent = stats.equalityScore !== undefined ? stats.equalityScore : '100';
    }

    if (currentResults && currentResults.length > 0) {
        downloadTxtBtn.classList.remove('hidden');
    }

    const list = document.getElementById('participants-list');
    list.innerHTML = '';

    const isSingleFile = currentResults && currentResults.length === 1;

    if (isSingleFile && stats.participants && stats.participants.length > 0) {
        // Single-file mode: one card per participant with detailed stats
        stats.participants.forEach(p => {
            const card = document.createElement('div');
            card.className = 'participant-card';
            card.innerHTML = `
                <span class="participant-name">${p.name}</span>
                <span class="participant-count">${p.count} turns &middot; ${p.words} words</span>
                <span class="participant-wpm">${p.wpm} WPM &middot; ${p.speakingSeconds}s speaking</span>
            `;
            list.appendChild(card);
        });

        // File preview card at the end
        const fileCard = document.createElement('div');
        fileCard.className = 'participant-card';
        fileCard.style = 'grid-column: 1/-1; border-color: var(--primary); cursor: pointer;';
        fileCard.title = 'Click to preview transcript';
        fileCard.innerHTML = `
            <span class="participant-name">${currentResults[0].filename}</span>
            <span class="participant-count">Click to preview transcript</span>
        `;
        fileCard.onclick = () => openPreview(currentResults[0]);
        list.appendChild(fileCard);
    } else if (currentResults) {
        // Batch mode: one card per file
        currentResults.forEach(res => {
            const card = document.createElement('div');
            card.className = 'participant-card';
            card.title = 'Click to preview';
            card.innerHTML = `
                <span class="participant-name">${res.filename}</span>
                <span class="participant-count">${res.totalMessages} turns</span>
            `;
            card.onclick = () => openPreview(res);
            list.appendChild(card);
        });
    }

    resultsSection.scrollIntoView({ behavior: 'smooth' });
}

/**
 * Populates and reveals the Global Statistics panel.
 * Only shown after a batch (ZIP) analysis.
 * @param {object} g - globalStats object from the server
 */
function displayGlobalStats(g) {
    const panel = document.getElementById('global-stats-panel');
    if (!panel || !g) return;

    document.getElementById('g-duration-min').textContent  = g.durationMinutes  ?? '0';
    document.getElementById('g-duration-sec').textContent  = g.durationSeconds  ?? '0';
    document.getElementById('g-wpm').textContent           = g.wpm              ?? '0';
    document.getElementById('g-response-time').textContent = g.meanResponseTimeSeconds ?? '0';
    document.getElementById('g-messages').textContent      = g.totalMessages     ?? '0';
    document.getElementById('g-words').textContent         = g.totalWords        ?? '0';
    document.getElementById('g-noise-ratio').textContent   = g.noiseRatio        ?? '0';
    document.getElementById('g-noise-count').textContent   = g.noiseMessagesCount ?? '0';
    document.getElementById('g-interruptions').textContent = g.interruptionCount ?? '0';
    document.getElementById('g-backchannels').textContent  = g.backchannelCount  ?? '0';

    panel.classList.remove('hidden');
}

function renderParticipationChart(participants) {
    const ctx = document.getElementById('participationChart').getContext('2d');
    if (participationChart) participationChart.destroy();
    if (!window.Chart) return;

    participationChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: participants.map(p => p.name),
            datasets: [{
                data: participants.map(p => p.words), // Use words for better professional precision
                backgroundColor: ['#6366f1', '#a855f7', '#ec4899', '#f43f5e', '#f59e0b', '#10b981', '#06b6d4'],
                borderWidth: 0
            }]
        },
        options: {
            plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8', font: { family: 'Outfit', size: 10 } } } },
            cutout: '70%',
            responsive: true
        }
    });
}

function renderNoiseChart(breakdown) {
    const ctx = document.getElementById('noiseChart').getContext('2d');
    if (noiseChart) noiseChart.destroy();
    if (!window.Chart || !breakdown) return;

    noiseChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Duration', 'Logistics', 'Agreement', 'Other'],
            datasets: [{
                label: 'Filtered Items',
                data: [breakdown.duration, breakdown.logistics, breakdown.backchannel, breakdown.other],
                backgroundColor: 'rgba(99, 102, 241, 0.6)',
                borderColor: '#6366f1',
                borderWidth: 1
            }]
        },
        options: {
            indexAxis: 'y',
            plugins: { legend: { display: false } },
            scales: {
                x: { grid: { color: 'rgba(255,255,255,0.05)' }, border: { display: false }, ticks: { color: '#94a3b8' } },
                y: { grid: { display: false }, border: { display: false }, ticks: { color: '#94a3b8' } }
            },
            responsive: true
        }
    });
}

function openPreview(data) {
    if (!data || !data.preview) {
        showError('Transcript data not available for this file.');
        return;
    }
    activePreviewData = data;
    modalTitle.textContent = `Preview: ${data.filename}`;
    rawPreview.textContent = data.preview.raw || '(No raw text detected)';
    cleanPreview.textContent = data.preview.clean || '(No semantic turns detected with current settings)';
    previewModal.classList.remove('hidden');
}
