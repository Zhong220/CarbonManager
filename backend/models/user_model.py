from werkzeug.security import generate_password_hash, check_password_hash
from flask_jwt_extended import create_access_token, create_refresh_token
import mysql.connector
import os
from contextlib import contextmanager
from config import Config

@contextmanager
def get_db():
    """Context manager for database connections"""
    conn = None
    try:
        conn = mysql.connector.connect(**DB_CONFIG)
        yield conn
    except mysql.connector.Error as e:
        print(f"Error connecting to MySQL: {e}")
        raise
    finally:
        if conn and conn.is_connected():
            conn.close()

USER_COLLECTION = 'users'

def create_user(account, password, user_name):
    hashed_password = generate_password_hash(password)
    with get_db() as conn:
        cursor = conn.cursor(dictionary=True)
        sql = "INSERT INTO users (account, password, user_name) VALUES (%s, %s, %s)"
        values = (account, hashed_password, user_name)
        cursor.execute(sql, values)
        conn.commit()
        return cursor.lastrowid

def get_user_by_account(account):
    with get_db() as conn:
        cursor = conn.cursor(dictionary=True)
        sql = "SELECT * FROM users WHERE account = %s"
        cursor.execute(sql, (account,))
        return cursor.fetchone()

def verify_password(stored_password, provided_password):
    return check_password_hash(stored_password, provided_password)

def generate_tokens(user_id, account):
    """Generate access and refresh tokens for the user"""
    access_token = create_access_token(
        identity=user_id,
        additional_claims={
            'account': account
        }
    )
    refresh_token = create_refresh_token(
        identity=user_id,
        additional_claims={
            'account': account
        }
    )
    return {
        'access_token': access_token,
        'refresh_token': refresh_token
    }

def get_user_by_id(user_id):
    """Get user by their ID"""
    with get_db() as conn:
        cursor = conn.cursor(dictionary=True)
        sql = "SELECT * FROM users WHERE id = %s"
        cursor.execute(sql, (user_id,))
        return cursor.fetchone()
