"""
Configuration file for the Smart Disaster Response System.
Contains database connection settings and application configuration.

IMPORTANT: Update the database credentials below to match your MySQL setup.
"""


class Config:
    """Base configuration class."""

    # Flask settings
    SECRET_KEY = 'disaster-response-secret-key-2025'
    DEBUG = True

    # MySQL Database settings
    # UPDATE THESE VALUES to match your MySQL installation
    DB_HOST = 'localhost'
    DB_PORT = 3306
    DB_USER = 'root'               # Your MySQL username
    DB_PASSWORD = 'Parimittal@2007'  # Your MySQL password
    DB_NAME = 'disaster_response'  # Database name (we will create this in Phase 2)

    # Connection pool settings
    DB_POOL_NAME = 'disaster_pool'
    DB_POOL_SIZE = 5