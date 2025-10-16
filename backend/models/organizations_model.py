# backend/models/organizations_model.py
from db_connection import get_db


def get_organization_by_id(org_id: int) -> dict | None:
    sql = """
        SELECT id, name, slug, created_at 
        FROM organizations 
        WHERE id = %s
    """
    with get_db() as conn:
        cur = conn.cursor(dictionary=True)
        try:
            cur.execute(sql,(org_id,),)
            return cur.fetchone()
        finally:
            cur.close()
          

def get_organization_by_name(name: str) -> dict | None:
    sql = """
        SELECT id, name, slug, created_at 
        FROM organizations 
        WHERE name = %s
        """
    with get_db() as conn:
        cur = conn.cursor(dictionary=True)
        try:
            cur.execute(sql,(name,),)
            return cur.fetchone()
        finally:
            cur.close()


def create_organization(name: str, slug: str | None = None) -> dict:
    existing = get_organization_by_name(name)
    if existing:
        return existing
    sql = """ 
        INSERT INTO organizations (name, slug)  
        VALUES (%s, %s)
        """ 
    with get_db() as conn:  
        cur = conn.cursor()
        try:
            cur.execute(sql,(name, slug),)
            conn.commit()
            new_id = cur.lastrowid
            return {"id": new_id, "name": name}
        finally:
            cur.close()
   
# def get_organization_by_slug(slug: str) -> dict | None:
#     sql = """
#         SELECT id, name, slug, created_at 
#         FROM organizations 
#         WHERE slug = %s
#         """
#     with get_db() as conn:
#         cur = conn.cursor(dictionary=True)
#         try:
#             cur.execute(sql,(slug,),)
#             return cur.fetchone()
#         finally:
#             cur.close()

def list_organizations(limit: int = 50) -> list[dict]:
    sql = """
        SELECT id, name, slug, created_at 
        FROM organizations 
        ORDER BY created_at 
        DESC LIMIT %s
        """
    with get_db() as conn:
        cur = conn.cursor(dictionary=True)
        try:
            cur.execute(sql,(limit,),)
            return cur.fetchall()
        finally:
            cur.close()

def assign_user_to_org(user_id: int, org_id: int):
    sql = """
        UPDATE users 
        SET organization_id = %s 
        WHERE id = %s
        """
    with get_db() as conn:
        cur = conn.cursor()
        try:
            cur.execute(sql,(org_id, user_id),
            )
            conn.commit()
        finally:
            cur.close()
