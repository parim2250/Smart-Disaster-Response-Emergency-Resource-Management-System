"""
Entry point for the Smart Disaster Response System.
Run this file to start the Flask development server.

Usage:
    python run.py
"""

from backend.app import create_app

# Create the Flask application instance
app = create_app()

if __name__ == '__main__':
    print("\n" + "=" * 60)
    print("  SMART DISASTER RESPONSE SYSTEM")
    print("  Emergency Resource Management")
    print("=" * 60)
    print(f"  Server starting on: http://127.0.0.1:5000")
    print(f"  Press CTRL+C to stop the server")
    print("=" * 60 + "\n")

    app.run(
        host='127.0.0.1',
        port=5000,
        debug=True
    )