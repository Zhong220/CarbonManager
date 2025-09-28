# backend/models/organization_model.py
from db_connection import get_db

def create_organization(name: str, slug: str | None = None) -> int:
    with get_db() as conn:
        cur = conn.cursor()
        try:
            cur.execute(
                """
                INSERT INTO organizations (name, slug)
                VALUES (%s, %s)
                """,
                (name, slug),
            )
            conn.commit()
            return cur.lastrowid
        finally:
            cur.close()

def get_organization_by_id(org_id: int) -> dict | None:
    with get_db() as conn:
        cur = conn.cursor(dictionary=True)
        try:
            cur.execute(
                "SELECT id, name, slug, created_at FROM organizations WHERE id = %s",
                (org_id,),
            )
            return cur.fetchone()
        finally:
            cur.close()

def get_organization_by_slug(slug: str) -> dict | None:
    with get_db() as conn:
        cur = conn.cursor(dictionary=True)
        try:
            cur.execute(
                "SELECT id, name, slug, created_at FROM organizations WHERE slug = %s",
                (slug,),
            )
            return cur.fetchone()
        finally:
            cur.close()

def list_organizations(limit: int = 50) -> list[dict]:
    with get_db() as conn:
        cur = conn.cursor(dictionary=True)
        try:
            cur.execute(
                "SELECT id, name, slug, created_at FROM organizations ORDER BY created_at DESC LIMIT %s",
                (limit,),
            )
            return cur.fetchall()
        finally:
            cur.close()

def assign_user_to_org(user_id: int, org_id: int):
    with get_db() as conn:
        cur = conn.cursor()
        try:
            cur.execute(
                "UPDATE users SET organization_id = %s, user_type = 'shop' WHERE id = %s",
                (org_id, user_id),
            )
            conn.commit()
        finally:
            cur.close()
