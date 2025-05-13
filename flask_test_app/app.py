from flask import Flask, render_template, request, redirect, jsonify
from flask_cors import CORS
import yaml, os

app = Flask(__name__)
CORS(app, resources={
    r"/submit": {"origins": "*"},
    r"/config": {"origins": "*"}
})

temp_configs = {}  # In-memory dynamic config store

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/submit', methods=['POST'])
def submit():
    email = request.form.get('email')
    phone = request.form.get('phone')  # optional future field
    target_domain = request.form.get('target') or 'haveibeenpwned.com'

    temp_configs[target_domain] = {
        'fields': {
            'email': {
                'input#AccountCheck_Account': email
            },
            'phone': {
                'input#PhoneField': phone or ''
            }
        }
    }

    return redirect(f"https://{target_domain}/")

@app.route('/config', methods=['GET'])
def get_config():
    origin = request.args.get('origin')
    if origin in temp_configs:
        return jsonify(temp_configs[origin])

    config_path = os.path.join('configs', f'{origin}.yaml')
    if os.path.exists(config_path):
        with open(config_path, 'r') as f:
            config = yaml.safe_load(f)
        return jsonify(config)

    return jsonify({'error': 'No config found'}), 404

if __name__ == '__main__':
    app.run(port=5000, debug=True)
