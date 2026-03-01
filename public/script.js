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
    if (!file.name.endsWith('.vtt')) {
        alert('Please select a .vtt file');
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

    try {
        const response = await fetch('/api/analyze', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) throw new Error('Failed to analyze VTT');

        const stats = await response.json();
        displayResults(stats);
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
