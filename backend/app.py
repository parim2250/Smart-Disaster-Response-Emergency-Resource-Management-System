"""
Main Flask application for the Smart Disaster Response System.
This file creates and configures the Flask app instance.
"""

import os
from flask import Flask, render_template, jsonify
from backend.config import Config
from backend.db import initialize_pool, test_connection


def create_app():
    """
    Application factory function.
    Creates and configures the Flask application.
    """

    # Determine absolute paths for templates and static files
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    template_dir = os.path.join(base_dir, 'frontend', 'templates')
    static_dir = os.path.join(base_dir, 'frontend', 'static')

    # Create the Flask app with custom template and static folder paths
    app = Flask(
        __name__,
        template_folder=template_dir,
        static_folder=static_dir
    )

    # Load configuration
    app.config.from_object(Config)

    # Attempt to initialize the database connection pool
    # This may fail if MySQL is not running or the database doesn't exist yet
    # That's okay for Phase 1 — we will create the database in Phase 2
    db_initialized = initialize_pool()

    if not db_initialized:
        print("\n" + "=" * 60)
        print("  DATABASE NOT CONNECTED")
        print("  The app is running, but database features won't work.")
        print("  We will set up the database in Phase 2.")
        print("=" * 60 + "\n")

    # ----------------------------------------------------------------
    # ROUTES
    # ----------------------------------------------------------------

    @app.route('/')
    def index():
        """Serve the main dashboard page."""
        return render_template('index.html')

    @app.route('/api/health', methods=['GET'])
    def health_check():
        """
        Health check endpoint.
        Returns the status of the application and database connection.
        """
        db_status = test_connection()

        return jsonify({
            'application': 'Smart Disaster Response System',
            'status': 'running',
            'database': db_status
        })

    @app.route('/api/test', methods=['GET'])
    def test_api():
        """
        Simple test endpoint to verify that the API is working.
        """
        return jsonify({
            'message': 'API is working correctly!',
            'project': 'Smart Disaster Response & Emergency Resource Management System'
        })

    return app