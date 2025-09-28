# backend/models/user_model.py
from werkzeug.security import generate_password_hash, check_password_hash
from flask_jwt_extended import create_access_token, create_refresh_token
from db_connection import get_db

# Schema columns:
# id, email_account, email_ci (generated), password_hash, name,
# user_type ('shop'|'customer'), organization_id, created_at

def create_user(account: str, password: str, user_name: str, *, user_type: str = 'customer', organization_id: int | None = None) -> int:
    email = (account or '').strip()
    if not email or not password or not user_name:
        raise ValueError("account, password, and user_name are required")

    hashed = generate_password_hash(password)

    with get_db() as conn:
        cur = conn.cursor()
        try:
            cur.execute(
                """
                INSERT INTO users (email_account, password_hash, name, user_type, organization_id)
                VALUES (%s, %s, %s, %s, %s)
                """,
                (email, hashed, user_name, user_type, organization_id),
            )
            conn.commit()
            return cur.lastrowid
        finally:
            cur.close()

def get_user_by_account(account: str) -> dict | None:
    email = (account or '').strip().lower()
    if not email:
        return None

    with get_db() as conn:
        cur = conn.cursor(dictionary=True)
        try:
            cur.execute(
                "SELECT id, email_account, password_hash, name, user_type, organization_id, created_at "
                "FROM users WHERE email_ci = %s",
                (email,),
            )
            return cur.fetchone()
        finally:
            cur.close()

def verify_password(stored_hash: str, provided_password: str) -> bool:
    return check_password_hash(stored_hash, provided_password)

def generate_tokens(user_id: int, account: str, *, user_type: str = 'customer') -> dict:
    claims = {"account": account, "user_type": user_type}
    access_token = create_access_token(identity=str(user_id), additional_claims=claims)
    refresh_token = create_refresh_token(identity=str(user_id), additional_claims=claims)

    return {"access_token": access_token, "refresh_token": refresh_token}

def get_user_by_id(user_id: int) -> dict | None:
    with get_db() as conn:
        cur = conn.cursor(dictionary=True)
        try:
            cur.execute(
                "SELECT id, email_account, password_hash, name, user_type, organization_id, created_at "
                "FROM users WHERE id = %s",
                (user_id,),
            )
            return cur.fetchone()
        finally:
            cur.close()
