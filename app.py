from flask import Flask, render_template, request, jsonify
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import nltk
from nltk.tokenize import sent_tokenize
import io
import os
import traceback

# Download NLTK data to /tmp so it works on Vercel (read-only filesystem except /tmp)
_NLTK_DIR = '/tmp/nltk_data'
os.makedirs(_NLTK_DIR, exist_ok=True)
nltk.data.path.insert(0, _NLTK_DIR)
nltk.download('punkt',     download_dir=_NLTK_DIR, quiet=True)
nltk.download('punkt_tab', download_dir=_NLTK_DIR, quiet=True)

app = Flask(__name__)

# ── File-type detection & text extraction ───────────────────────────────────────

MIME_TO_EXT = {
    'application/pdf': '.pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    'application/msword': '.doc',
    'text/plain': '.txt',
}


def detect_ext(file):
    """Get extension from filename basename first, MIME type as fallback."""
    fname = os.path.basename(file.filename or '').lower()
    ext = os.path.splitext(fname)[1]
    if ext in ('.txt', '.pdf', '.docx', '.doc'):
        return ext
    # Fallback to MIME type (handles edge cases where ext is missing/wrong)
    mime = getattr(file, 'content_type', None) or getattr(file, 'mimetype', None) or ''
    return MIME_TO_EXT.get(mime.split(';')[0].strip(), ext or '.unknown')


def read_file_bytes(file):
    """Reliably read bytes from a Flask FileStorage or file-like object."""
    stream = getattr(file, 'stream', None)
    if stream is not None:
        stream.seek(0)
        return stream.read()
    return file.read()


def extract_text_from_file(file):
    """Extract plain text from a .txt, .pdf, or .docx upload."""
    ext = detect_ext(file)
    data = read_file_bytes(file)

    if not data:
        raise ValueError('The uploaded file appears to be empty.')

    # ── Plain text ───────────────────────────────────────────────────────────
    if ext == '.txt':
        try:
            return data.decode('utf-8')
        except UnicodeDecodeError:
            return data.decode('latin-1', errors='replace')

    # ── PDF ──────────────────────────────────────────────────────────────────
    elif ext == '.pdf':
        import pdfplumber
        text_parts = []
        with pdfplumber.open(io.BytesIO(data)) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text_parts.append(page_text)
        result = '\n'.join(text_parts).strip()
        if not result:
            raise ValueError(
                'No text could be extracted from this PDF. '
                'It may be a scanned/image-only PDF — try the "Paste Text" tab instead.'
            )
        return result

    # ── DOCX ─────────────────────────────────────────────────────────────────
    elif ext == '.docx':
        from docx import Document
        doc = Document(io.BytesIO(data))
        parts = [p.text for p in doc.paragraphs if p.text.strip()]
        # Also capture text inside tables
        for table in doc.tables:
            for row in table.rows:
                for cell in row.cells:
                    if cell.text.strip():
                        parts.append(cell.text.strip())
        return '\n'.join(parts)

    # ── Old Word binary .doc ─────────────────────────────────────────────────
    elif ext == '.doc':
        raise ValueError(
            'Old .doc format is not supported. '
            'Please open the file in Word and save as .docx, then upload again.'
        )

    else:
        raise ValueError(
            f'Unsupported file type "{ext}". '
            'Please upload a .txt, .pdf, or .docx file.'
        )


# ── Similarity functions ────────────────────────────────────────────────────────

def calculate_similarity(text1, text2):
    documents = [text1, text2]
    vectorizer = TfidfVectorizer(stop_words='english')
    tfidf_matrix = vectorizer.fit_transform(documents)
    similarity = cosine_similarity(tfidf_matrix)[0][1]
    return float(similarity)


def sentence_level_similarity(text1, text2, threshold=0.5):
    sentences1 = sent_tokenize(text1)
    sentences2 = sent_tokenize(text2)
    suspicious_pairs = []

    for s1 in sentences1:
        best_score = 0
        best_s2 = ''
        for s2 in sentences2:
            if len(s1.split()) < 3 or len(s2.split()) < 3:
                continue
            vectorizer = TfidfVectorizer(stop_words='english')
            try:
                tfidf = vectorizer.fit_transform([s1, s2])
                score = cosine_similarity(tfidf)[0][1]
                if score > best_score:
                    best_score = score
                    best_s2 = s2
            except Exception:
                continue

        if best_score > threshold:
            suspicious_pairs.append({
                's1': s1,
                's2': best_s2,
                'score': round(best_score * 100, 1)
            })

    suspicious_pairs.sort(key=lambda x: x['score'], reverse=True)
    return suspicious_pairs[:20]


# ── Routes ──────────────────────────────────────────────────────────────────────

@app.route('/')
def home():
    return render_template('index.html')


@app.route('/check', methods=['POST'])
def check():
    try:
        text1 = ''
        text2 = ''
        mode = request.form.get('mode', 'file')

        if mode == 'text':
            text1 = request.form.get('text1', '').strip()
            text2 = request.form.get('text2', '').strip()
        else:
            file1 = request.files.get('file1')
            file2 = request.files.get('file2')

            if not file1 or not file2:
                return jsonify({'error': 'Please upload both files.'}), 400

            try:
                text1 = extract_text_from_file(file1).strip()
            except ValueError as e:
                return jsonify({'error': f'Document 1: {str(e)}'}), 400
            except Exception as e:
                traceback.print_exc()
                return jsonify({'error': f'Document 1 could not be read: {str(e)}'}), 400

            try:
                text2 = extract_text_from_file(file2).strip()
            except ValueError as e:
                return jsonify({'error': f'Document 2: {str(e)}'}), 400
            except Exception as e:
                traceback.print_exc()
                return jsonify({'error': f'Document 2 could not be read: {str(e)}'}), 400

        if not text1 or not text2:
            return jsonify({'error': 'Both inputs must have content.'}), 400

        if len(text1.split()) < 5 or len(text2.split()) < 5:
            return jsonify({'error': 'Each document must have at least 5 words.'}), 400

        score = calculate_similarity(text1, text2)
        similarity = round(score * 100, 1)

        if score > 0.8:
            label = 'High Plagiarism'
            color = 'high'
        elif score > 0.5:
            label = 'Moderate Similarity'
            color = 'medium'
        elif score > 0.2:
            label = 'Low Similarity'
            color = 'low'
        else:
            label = 'Minimal Similarity'
            color = 'minimal'

        pairs = sentence_level_similarity(text1, text2)

        return jsonify({
            'similarity': similarity,
            'label': label,
            'color': color,
            'pairs': pairs,
            'word_count_1': len(text1.split()),
            'word_count_2': len(text2.split()),
        })

    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': f'Unexpected error: {str(e)}'}), 500


if __name__ == '__main__':
    app.run(debug=True)