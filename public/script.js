const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('vtt-input');
const analyzeBtn = document.getElementById('analyze-btn');
const resultsSection = document.getElementById('results');

let selectedFile = null;

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
        alert('Please select a .vtt or .zip file');
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

    const formData = new FormData();
    formData.append('vttFile', selectedFile);

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
            
            // Display global statistics in the UI
            displayResults(data.globalStats);
            
            // Add a notice that download finished
            const notice = document.createElement('div');
            notice.className = 'participant-card';
            notice.style = 'grid-column: 1/-1; text-align: center; border-color: var(--primary);';
            notice.innerHTML = `<span class="participant-name">Batch Analysis Complete!</span>
                                <span class="participant-count">Your CSV file has been downloaded.</span>`;
            document.getElementById('participants-list').prepend(notice);
        } else {
            const stats = await response.json();
            displayResults(stats);
        }
    } catch (err) {
        alert(err.message);
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
    
    const mrtElem = document.getElementById('mean-response-time');
    if (mrtElem) {
        mrtElem.textContent = stats.meanResponseTimeSeconds !== undefined ? stats.meanResponseTimeSeconds : '0';
    }

    const list = document.getElementById('participants-list');
    list.innerHTML = '';

    stats.participants
        .sort((a, b) => b.count - a.count)
        .forEach(p => {
            const card = document.createElement('div');
            card.className = 'participant-card';
            card.innerHTML = `
                <span class="participant-name">${p.name}</span>
                <span class="participant-count">${p.count} messages</span>
            `;
            list.appendChild(card);
        });

    resultsSection.scrollIntoView({ behavior: 'smooth' });
}
