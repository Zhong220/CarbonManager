# backend/models/factor_model.py
from db_connection import get_db
from mysql.connector import Error

def get_factor(factor_id):
    with get_db() as conn:
        cursor = conn.cursor(dictionary=True)
        sql = "SELECT * FROM factors WHERE id = %s"
        cursor.execute(sql, (factor_id,))
    return cursor.fetchone()

def search_factors(
    q=None,
    category=None,
    midcategory=None,
    subcategory=None,
    unit=None,
    limit=20,
    offset=0,
):
    with get_db() as conn:
        cursor = conn.cursor(dictionary=True)

        sql = """
            SELECT *
            FROM factors
            WHERE 1 = 1
        """
        params = []

        # free-text search
        if q:
            like = f"%{q}%"
            sql += """
                AND (
                    name LIKE %s
                    OR category LIKE %s
                    OR midcategory LIKE %s
                    OR subcategory LIKE %s
                )
            """
            params.extend([like, like, like, like])

        # exact filters
        if category:
            sql += " AND category = %s"
            params.append(category)

        if midcategory:
            sql += " AND midcategory = %s"
            params.append(midcategory)

        if subcategory:
            sql += " AND subcategory = %s"
            params.append(subcategory)

        if unit:
            sql += " AND unit = %s"
            params.append(unit)

        # ordering + pagination
        sql += " ORDER BY id LIMIT %s OFFSET %s"
        params.extend([limit, offset])

        cursor.execute(sql, tuple(params))
    return cursor.fetchall()
