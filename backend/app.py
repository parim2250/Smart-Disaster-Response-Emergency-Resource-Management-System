"""
Main Flask application — SENTINEL Emergency Command Interface.
"""

import os
from flask import Flask, render_template, jsonify
from backend.config import Config
from backend.db import initialize_pool, test_connection


def create_app():
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    template_dir = os.path.join(base_dir, 'frontend', 'templates')
    static_dir = os.path.join(base_dir, 'frontend', 'static')

    app = Flask(
        __name__,
        template_folder=template_dir,
        static_folder=static_dir
    )
    app.config.from_object(Config)

    db_ok = initialize_pool()
    if not db_ok:
        print('\n[WARNING] Database pool not initialized.\n')

    # Register API blueprint
    from backend.routes.api import api_bp
    app.register_blueprint(api_bp)

    @app.route('/')
    def index():
        return render_template('index.html')

    @app.route('/api/health', methods=['GET'])
    def health_check():
        db_status = test_connection()
        return jsonify({
            'application': 'SENTINEL Emergency Command Interface',
            'status': 'running',
            'database': db_status
        })

    @app.route('/api/test', methods=['GET'])
    def test_api():
        return jsonify({
            'message': 'API is working correctly!',
            'project': 'Smart Disaster Response & Emergency Resource Management System'
        })

    return app