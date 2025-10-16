from backend.database import get_db

STAGE_COLLECTION = "emission_stages"


def create_stage(name):
    with get_db() as conn:
        cursor = conn.cursor(dictionary=True)
        sql = "INSERT INTO emission_stages (name) VALUES (%s)"
        cursor.execute(sql, (name,))
        conn.commit()
        return cursor.lastrowid


def get_stage(stage_id):
    with get_db() as conn:
        cursor = conn.cursor(dictionary=True)
        sql = "SELECT * FROM emission_stages WHERE id = %s"
        cursor.execute(sql, (stage_id,))
        return cursor.fetchone()


def get_all_stages():
    with get_db() as conn:
        cursor = conn.cursor(dictionary=True)
        sql = "SELECT * FROM emission_stages"
        cursor.execute(sql)
        return cursor.fetchall()


def update_stage(stage_id, data):
    with get_db() as conn:
        cursor = conn.cursor()
        sql = "UPDATE emission_stages SET name = %s WHERE id = %s"
        cursor.execute(sql, (data["name"], stage_id))
        conn.commit()
        return True


def delete_stage(stage_id):
    with get_db() as conn:
        cursor = conn.cursor()
        sql = "DELETE FROM emission_stages WHERE id = %s"
        cursor.execute(sql, (stage_id,))
        conn.commit()
        return True
