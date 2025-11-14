# backend/routes/emissions.py
from db_connection import get_db

def get_steps_under_product_stage(product_id, stage_id):
    with get_db() as db:
        cursor = db.cursor(dictionary=True)
        sql = """
            SELECT steps.*
            FROM steps
            JOIN stages ON steps.stage_id = stages.id
            WHERE steps.product_id = %s AND stages.id = %s
            ORDER BY steps.sort_order ASC, steps.id ASC
        """
        cursor.execute(sql, (product_id, stage_id, ))
        return cursor.fetchall()


def create_steps( product_id, stage_id, tag_id, name, sort_order):
    with get_db() as db:
        cursor = db.cursor()
        sql = """
            INSERT INTO steps ( product_id, stage_id, tag_id, name, sort_order)
            VALUES (%s, %s, %s, %s, %s)
        """
        cursor.execute(sql, (product_id, stage_id, tag_id, name, sort_order, ))
        db.commit()
        return cursor.lastrowid

