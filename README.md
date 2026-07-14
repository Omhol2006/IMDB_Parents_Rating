# 🎬 CineGuard — Know Before You Watch

A cinematic parental guidance tool that integrates **IMDb parental ratings** with **Letterboxd** user lists. Search any movie or series for its content breakdown, or paste a Letterboxd list URL to sort all films by their Sex & Nudity rating.

## Features
- 🔍 **Movie Search** — Search any movie/series and instantly get the full IMDb parental guide breakdown (Sex & Nudity, Violence, Profanity, Alcohol, Frightening scenes)
- 📋 **Letterboxd Sorter** — Paste any public Letterboxd list or watchlist URL and sort all films from *None* to *Severe* by their nudity rating
- ⚡ **Fast** — Fetches 5 films in parallel for rapid list processing
- 🌙 **Premium dark UI** — Cinematic dark-mode interface

## Tech Stack
- **Backend:** Python + Flask
- **Frontend:** Vanilla HTML, CSS, JavaScript
- **Data Sources:** IMDb GraphQL API + Letterboxd scraping (no API keys needed)

## Setup & Running Locally

### 1. Install dependencies
```bash
pip install -r requirements.txt
```

### 2. Start the server
```bash
python server.py
```

### 3. Open in browser
Go to `http://localhost:5000`

## Deploying on a Shared SSH Server

### Install & run
```bash
# Create a virtual environment (no root needed)
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Run in background (stays alive after SSH disconnect)
nohup python server.py &
```

Access via `http://your-server-ip:5000`

### For cPanel hosting
Set `passenger_wsgi.py` as the Application Startup File in the Python App setup.

## Project Structure
```
cineguard/
├── server.py              # Flask backend + IMDb/Letterboxd API logic
├── passenger_wsgi.py      # WSGI entry point for cPanel/Passenger hosting
├── requirements.txt       # Python dependencies
├── public/
│   ├── index.html         # Main UI
│   ├── style.css          # Dark cinematic styles
│   └── app.js             # Frontend logic
```
