# HLGS — Human-Like Grading System

## What is this?
AI-powered subjective answer evaluator using a 5-layer pipeline.
Student B (conceptual) always scores higher than Student A (factual).

## Tech Stack
| Layer    | Technology |
|----------|-----------|
| Frontend | React + TailwindCSS + Vite |
| Backend  | FastAPI + SQLAlchemy + SQLite |
| AI       | Anthropic Claude API (Bloom's classification) |
| NLP      | Sentence-BERT, KeyBERT, spaCy, NLTK |

## Setup

### 1. Clone and configure
```bash
git clone <your-repo>
cd hlgs
```
Add your Anthropic API key to `.env`:
```
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

### 2. Backend
```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS / Linux
pip install -r requirements.txt
python -m spacy download en_core_web_sm
python -m nltk.downloader wordnet
uvicorn main:app --reload --port 8000
```

### 3. Frontend
```bash
cd frontend
npm install
npm run dev
```

### 4. Open
| Service  | URL |
|----------|-----|
| Frontend | http://localhost:5173 |
| API docs | http://localhost:8000/docs |

## How the 5 Layers Work
| Layer | Name | Description |
|-------|------|-------------|
| 1 | Preprocessing   | Cleans and normalises text |
| 2 | Keyword Scoring | Checks factual coverage (KeyBERT + WordNet) |
| 3 | Semantic Score  | Meaning similarity (Sentence-BERT cosine) |
| 4 | Bloom's Level   | Cognitive depth (Claude API, temperature=0) |
| 5 | Theme & Depth   | Thematic coverage + causal reasoning density |

## Score Formula
```
final = (keyword×0.20 + semantic×0.30 + bloom×0.30 + theme×0.20) × max_marks
```

## API Endpoints
| Method | Path | Description |
|--------|------|-------------|
| GET    | /api/health        | Service health check |
| POST   | /api/grade         | Grade a student answer |
| GET    | /api/results       | List all grading records |
| GET    | /api/results/{id}  | Fetch a single record |
| DELETE | /api/results/{id}  | Delete a record |
| GET    | /api/stats         | Aggregated statistics |
| GET    | /api/export        | Download all results as CSV |
