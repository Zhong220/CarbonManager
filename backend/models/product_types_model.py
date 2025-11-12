# backend/models/product_types_model.py
from __future__ import annotations
from db_connection import get_db


# -------------- CREATE A PRODUCT TYPE ---------------
def create_product_type(organization_id: int, name: str) -> int:
    with get_db() as conn:
        cur = conn.cursor()
        try:
            conn.start_transaction()  # disables autocommit for this tx

            cur.execute(
                "SELECT COALESCE(MAX(order_id), 0) + 1 "
                "FROM product_types WHERE organization_id=%s FOR UPDATE",
                (organization_id,)
            )
            (next_order,) = cur.fetchone()

            cur.execute(
                "INSERT INTO product_types (organization_id, name, order_id) "
                "VALUES (%s, %s, %s)",
                (organization_id, name, next_order,)
            )
            conn.commit()
            return cur.lastrowid
        except Exception:
            conn.rollback()
            raise
        finally:
            cur.close()


# ----- GET ALL PRODUCT TYPES UNDER ONE ORG ---------------
def list_product_types(organization_id: int) -> list[dict]:
    sql = """
        SELECT 
            id, 
            name, 
            order_id,
            organization_id, 
            created_at
        FROM product_types
        WHERE organization_id = %s
        ORDER BY order_id ASC
    """
    with get_db() as conn:
        cur = conn.cursor(dictionary=True)
        try:
            cur.execute(
                sql,
                (organization_id,),
            )
            return cur.fetchall()
        finally:
            cur.close()


# -------------- UPDATE A PRODUCT TYPE --------------
def modify_product_type(
    new_name: str, organization_id: int, product_type_id: int
) -> bool:
    sql = """
        UPDATE product_types
        SET name = %s
        WHERE organization_id = %s AND id = %s
    """
    with get_db() as conn:
        cur = conn.cursor()
        try:
            cur.execute(
                sql,
                (new_name, organization_id, product_type_id),
            )
            conn.commit()
            return cur.rowcount > 0
        finally:
            cur.close()


# -------------- DELETE A PRODUCT TYPE
def delete_product_type(organization_id: str, product_type_id: int) -> bool:
    sql = """
        DELETE FROM product_types
        WHERE organization_id = %s AND id = %s
        """
    with get_db() as conn:
        cur = conn.cursor()
        try:
            cur.execute(
                sql,
                (
                    organization_id,
                    product_type_id,
                ),
            )
            conn.commit()
            return cur.rowcount > 0
        finally:
            cur.close()


# -------------- GET A PRODUCT TYPE BY ID ---------------
def get_product_type_by_id(organization_id: int, product_type_id: int) -> dict | None:
    sql = """
        SELECT
            P.id, P.name, P.created_at, P.organization_id, P.updated_at, O.name AS organization_name
        FROM product_types AS P
        JOIN organizations AS O ON O.id = P.organization_id
        WHERE P.organization_id = %s AND P.id = %s
        LIMIT 1
        """
    with get_db() as conn:
        cur = conn.cursor(dictionary=True)
        try:
            cur.execute(sql, (organization_id, product_type_id))
            return cur.fetchone()
        finally:
            cur.close()
