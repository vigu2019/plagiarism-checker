# 🛡️ PlagiaShield — AI-Powered Plagiarism Checker

A modern web app to detect plagiarism between two documents using **TF-IDF + Cosine Similarity**. Built with Flask, featuring a premium dark glassmorphism UI.

![Python](https://img.shields.io/badge/Python-3.10+-blue?logo=python)
![Flask](https://img.shields.io/badge/Flask-3.x-black?logo=flask)
![License](https://img.shields.io/badge/License-MIT-green)

public URL: https://plagiarism-checker-1869.onrender.com

---

## ✨ Features

- 📂 **Upload Files** — drag & drop `.txt`, `.pdf`, or `.docx` files
- ✍️ **Paste Text** — directly paste content for instant comparison
- 🔄 **Animated similarity score ring** — visual percentage meter
- 📊 **Sentence-level match breakdown** — see exactly which sentences are similar
- ⚡ **No page reload** — smooth SPA-like experience with `fetch()` API
- 📱 **Fully responsive** — works on mobile and desktop

## 🖥️ Screenshots

> Dark glassmorphism UI with animated score ring and sentence match cards.

---

## 🚀 Getting Started (Local)

### 1. Clone the repo
```bash
git clone https://github.com/vigu2019/plagiarism-checker.git
cd plagiarism-checker
```

### 2. Install dependencies
```bash
pip install -r requirements.txt
```

### 3. Run the app
```bash
python app.py
```

Open **http://127.0.0.1:5000** in your browser.

---

## 🗂️ Project Structure

```
plagiarism-checker/
├── app.py                  # Flask backend — similarity logic + API
├── requirements.txt        # Python dependencies
├── Procfile                # Render/Heroku deployment config
├── templates/
│   └── index.html          # Main UI
└── static/
    ├── style.css           # Dark glassmorphism styles
    └── script.js           # Frontend logic (tabs, drag-drop, fetch, animations)
```

---

## 🧠 How It Works

1. Two documents are uploaded or pasted
2. Text is extracted (supports `.txt`, `.pdf`, `.docx`)
3. Both texts are vectorized using **TF-IDF**
4. **Cosine similarity** is computed between the two vectors
5. Individual sentences are compared to identify suspicious matches
6. Results are returned as JSON and rendered live in the browser

### Similarity Thresholds

| Score | Label |
|---|---|
| > 80% | 🔴 High Plagiarism |
| 50–80% | 🟡 Moderate Similarity |
| 20–50% | 🟢 Low Similarity |
| < 20% | 🔵 Minimal Similarity |

---

## 📦 Dependencies

| Package | Purpose |
|---|---|
| `flask` | Web framework |
| `scikit-learn` | TF-IDF vectorization & cosine similarity |
| `nltk` | Sentence tokenization |
| `pdfplumber` | PDF text extraction |
| `python-docx` | Word (.docx) text extraction |
| `gunicorn` | Production WSGI server |

---

## ☁️ Deployment (Render)

1. Push this repo to GitHub
2. Go to [render.com](https://render.com) → New Web Service
3. Connect your GitHub repo and set:
   - **Build command:** `pip install -r requirements.txt`
   - **Start command:** `gunicorn app:app`
4. Click Deploy — get a live public URL 🎉

---

## 📄 License

MIT License — free to use, modify, and distribute.
