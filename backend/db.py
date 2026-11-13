"""
Database connection handler for the Smart Disaster Response System.
Manages MySQL database connections using connection pooling.
"""

import mysql.connector
from mysql.connector import pooling, Error
from backend.config import Config


# Global variable to hold the connection pool
connection_pool = None


def initialize_pool():
    """
    Initialize the MySQL connection pool.
    This should be called once when the application starts.
    Returns True if successful, False otherwise.
    """
    global connection_pool

    try:
        connection_pool = pooling.MySQLConnectionPool(
            pool_name=Config.DB_POOL_NAME,
            pool_size=Config.DB_POOL_SIZE,
            pool_reset_session=True,
            host=Config.DB_HOST,
            port=Config.DB_PORT,
            user=Config.DB_USER,
            password=Config.DB_PASSWORD,
            database=Config.DB_NAME,
            autocommit=False  # We will manage transactions manually where needed
        )
        print(f"[SUCCESS] Database connection pool created successfully.")
        print(f"[INFO] Connected to MySQL database: {Config.DB_NAME}")
        return True

    except Error as e:
        print(f"[ERROR] Failed to create connection pool: {e}")
        print(f"[INFO] The application will run but database features will not work.")
        print(f"[INFO] Make sure MySQL is running and the database '{Config.DB_NAME}' exists.")
        return False


def get_db_connection():
    """
    Get a connection from the connection pool.
    Returns a MySQL connection object, or None if the pool is not initialized.
    """
    global connection_pool

    if connection_pool is None:
        print("[WARNING] Connection pool is not initialized.")
        return None

    try:
        connection = connection_pool.get_connection()
        return connection

    except Error as e:
        print(f"[ERROR] Failed to get connection from pool: {e}")
        return None


def close_connection(connection, cursor=None):
    """
    Safely close a database cursor and return the connection to the pool.

    Parameters:
        connection: The MySQL connection object to close.
        cursor: The cursor object to close (optional).
    """
    try:
        if cursor is not None:
            cursor.close()
        if connection is not None and connection.is_connected():
            connection.close()  # Returns the connection to the pool
    except Error as e:
        print(f"[ERROR] Error closing connection: {e}")


def test_connection():
    """
    Test whether the database connection works.
    Returns a dictionary with connection status information.
    """
    connection = get_db_connection()

    if connection is None:
        return {
            'status': 'error',
            'message': 'Could not establish database connection. '
                       'Make sure MySQL is running and the database exists.'
        }

    try:
        cursor = connection.cursor()
        cursor.execute("SELECT VERSION()")
        version = cursor.fetchone()

        cursor.execute("SELECT DATABASE()")
        db_name = cursor.fetchone()

        result = {
            'status': 'success',
            'mysql_version': version[0] if version else 'Unknown',
            'database': db_name[0] if db_name else 'Unknown',
            'message': 'Database connection is working correctly.'
        }

        close_connection(connection, cursor)
        return result

    except Error as e:
        close_connection(connection)
        return {
            'status': 'error',
            'message': f'Database connection test failed: {str(e)}'
        }