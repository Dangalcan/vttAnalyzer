# VTT Analyzer

VTT Analyzer is a modern Web application designed to extract and visualize conversation statistics from WebVTT (.vtt) files. It provides insights into conversation duration, participant activity, and overall message counts through a premium, glassmorphism-inspired interface.

## 🚀 Features

- **Instant Analysis**: Simply drop a .vtt file to get real-time statistics.
- **Detailed Stats**:
  - Total conversation time (minutes and seconds).
  - Number of participants.
  - Total messages sent.
  - Message count breakdown per participant.
- **Premium Design**: Modern dark theme with smooth animations and responsive layout.
- **Robust Parsing**: Correctly handles overlapping cues and decodes HTML entities in participant names.
- **Docker Ready**: Minimal image footprint using multi-stage Alpine builds.
- **Tested**: Comprehensive test suite using Vitest.

## 🛠️ Tech Stack

- **Backend**: Node.js, Express, Multer (file handling), He (HTML decoding).
- **Frontend**: Vanilla HTML5, CSS3 (Glassmorphism), JavaScript (ES6+).
- **Testing**: Vitest.
- **DevOps**: Docker (Alpine), Dotenv.

## 📦 Installation & Setup

### Prerequisites
- Node.js (v22+ recommended)
- npm

### Local Setup
1. Clone or download the repository.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file (you can copy `.env.example` if available):
   ```env
   PORT=3000
   ```
4. Start the server:
   ```bash
   npm start
   ```
5. Open your browser at `http://localhost:3000`.

## 🧪 Testing

The project includes a suite of automated tests to ensure parsing accuracy.

Run tests:
```bash
npm test
```

## 🐳 Dockerization

The application is fully dockerized with a focus on image size.

### Build the Image
```bash
docker build -t vtt-analyzer .
```

### Run the Container
```bash
docker run -p 3000:3000 --env-file .env vtt-analyzer
```

## 📄 License
This project is for educational/demonstration purposes.

---
**Author**: Daniel Galván Cancio
