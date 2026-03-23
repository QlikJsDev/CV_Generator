import os
import io
import tempfile
from flask import Flask, render_template, request, send_file, jsonify

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 20 * 1024 * 1024  # 20 MB upload limit

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SA_TEMPLATE = os.path.join(BASE_DIR, 'word_templates', 'select_advisory.docx')


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/parse', methods=['POST'])
def parse_cv():
    """Parse an uploaded Beyond Data .docx and return form-ready JSON."""
    if 'file' not in request.files:
        return jsonify({'error': 'No file uploaded'}), 400

    f = request.files['file']
    if not f.filename.lower().endswith('.docx'):
        return jsonify({'error': 'Please upload a .docx file'}), 400

    try:
        from generators.bd_parser import parse_beyond_data_cv
        buf = io.BytesIO(f.read())
        data = parse_beyond_data_cv(buf)
        return jsonify(data)
    except Exception as e:
        import traceback
        return jsonify({'error': str(e), 'trace': traceback.format_exc()}), 500


@app.route('/generate', methods=['POST'])
def generate():
    """Generate a Select Advisory .docx from form JSON data."""
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data provided'}), 400

    if not os.path.exists(SA_TEMPLATE):
        return jsonify({'error': f'Template not found at {SA_TEMPLATE}'}), 500

    try:
        from generators.select_advisory import generate_select_advisory
        buffer = generate_select_advisory(data, SA_TEMPLATE)

        first = data.get('firstName', 'CV').strip()
        last  = data.get('lastName', '').strip().upper()
        filename = f'{first} {last} - Select Advisory CV.docx'.strip()

        return send_file(
            buffer,
            as_attachment=True,
            download_name=filename,
            mimetype='application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        )
    except Exception as e:
        import traceback
        return jsonify({'error': str(e), 'trace': traceback.format_exc()}), 500


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('FLASK_ENV') != 'production'
    print(f'CV Generator running at http://localhost:{port}')
    app.run(debug=debug, host='0.0.0.0', port=port)
