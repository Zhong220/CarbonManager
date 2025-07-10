import mysql.connector
import os
from contextlib import contextmanager
from dotenv import load_dotenv
from config import Config

@contextmanager
def get_db():
    conn = None
    try:
        conn = mysql.connector.connect(**Config.DB_CONFIG)
        yield conn
    except mysql.connector.Error as e:
        print(f"Error connecting to MySQL: {e}")
        raise
    finally:
        if conn and conn.is_connected():
            conn.close() 