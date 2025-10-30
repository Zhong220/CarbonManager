# backend/models/products_model.py
import json
from typing import Optional
from db_connection import get_db


# ##################################### products ###########################
# +-----------------+-----------------+------+-----+-------------------+-------------------+
# | Field           | Type            | Null | Key | Default           | Extra             |
# +-----------------+-----------------+------+-----+-------------------+-------------------+
# | id              | bigint unsigned | NO   | PRI | NULL              | auto_increment    |
# | organization_id | bigint unsigned | NO   | MUL | NULL              |                   |
# | type_id         | bigint unsigned | YES  | MUL | NULL              |                   |
# | name            | varchar(200)    | NO   |     | NULL              |                   |
# | serial_number   | varchar(100)    | YES  |     | NULL              |                   |
# | total_emission  | double          | YES  |     | 0                 |                   |
# | created_at      | timestamp       | NO   |     | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
# | ended_at        | timestamp       | YES  |     | NULL              |                   |
# | code            | varchar(50)     | YES  |     | NULL              |                   |
# +-----------------+-----------------+------+-----+-------------------+-------------------+

# -------------- CREATE A PRODUCT ---------------
def create_product(organization_id: int, type_id: int, name: str, serial_number: Optional[str], code: Optional[str]) -> int:
    sql = """
        INSERT INTO products 
            (organization_id, 
            type_id, 
            name, 
            serial_number, 
            code)
        VALUES (%s, %s, %s, %s, %s)
    """
    with get_db() as conn:
        cur = conn.cursor()
        try:
            cur.execute(sql, (organization_id, type_id, name, serial_number, code))
            conn.commit()
            return cur.lastrowid
        finally:
            cur.close()

# ----- GET ALL PRODUCT UNDER ONE PRODUCT TYPES OF ONE ORG ---------------
def list_products( organization_id: int, product_type_id: int ) -> list[dict]:
    sql = """
        SELECT 
            p.id, 
            p.name, 
            p.serial_number, 
            p.total_emission, 
            p.created_at, 
            p.ended_at, 
            p.code
        FROM products p
        WHERE organization_id = %s AND p.type_id = %s
        ORDER BY p.created_at DESC
    """
    with get_db() as conn:
        cur = conn.cursor(dictionary=True)
        try:
            cur.execute(
                sql, 
                (organization_id, product_type_id,),
            )
            return cur.fetchall()
        finally:
            cur.close()
    
# -------------- UPDATE A PRODUCT ---------------
def update_product(product_id: int, organization_id: int, type_id: Optional[int], name: str, serial_number: Optional[str], code: Optional[str]) -> None:
    sql = """
        UPDATE products
        SET organization_id = %s,
            type_id = %s,
            name = %s,
            serial_number = %s,
            code = %s
        WHERE id = %s
    """
    with get_db() as conn:
        cur = conn.cursor()
        try:
            cur.execute(sql, (organization_id, type_id, name, serial_number, code, product_id))
            conn.commit()
        finally:
            cur.close()

# -------------- FETCH A PRODUCT BY ID ---------------
def fetch_product(product_id: int) -> Optional[dict]:
    sql = """
        SELECT 
            id, 
            organization_id, 
            type_id, 
            name, 
            serial_number, 
            total_emission, 
            created_at, 
            ended_at, 
            code
        FROM products
        WHERE id = %s
        LIMIT 1
    """
    with get_db() as conn:
        cur = conn.cursor(dictionary=True)
        try:
            cur.execute(sql, (product_id,))
            return cur.fetchone()
        finally:
            cur.close()
          
          
# -------------- DELETE A PRODUCT ---------------
def delete_product(product_id: int) -> None:
    sql = """
        DELETE FROM products
        WHERE id = %s
    """
    with get_db() as conn:
        cur = conn.cursor()
        try:
            cur.execute(sql, (product_id,))
            conn.commit()
        finally:
            cur.close()
            