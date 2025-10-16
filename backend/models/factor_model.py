from backend.database import get_db

FACTOR_COLLECTION = "factors"


def create_factor(
    name, unit, value_per_unit, category, region="Taiwan", source="環境部"
):
    with get_db() as conn:
        cursor = conn.cursor(dictionary=True)
        sql = """
            INSERT INTO factors (name, unit, value_per_unit, category, region, source)
            VALUES (%s, %s, %s, %s, %s, %s)
        """
        values = (name, unit, float(value_per_unit), category, region, source)
        cursor.execute(sql, values)
        conn.commit()
        return cursor.lastrowid


def get_factor(factor_id):
    with get_db() as conn:
        cursor = conn.cursor(dictionary=True)
        sql = "SELECT * FROM factors WHERE id = %s"
        cursor.execute(sql, (factor_id,))
        return cursor.fetchone()


def get_factors_by_category(category):
    with get_db() as conn:
        cursor = conn.cursor(dictionary=True)
        sql = "SELECT * FROM factors WHERE category = %s"
        cursor.execute(sql, (category,))
        return cursor.fetchall()


def get_factors_by_region(region):
    with get_db() as conn:
        cursor = conn.cursor(dictionary=True)
        sql = "SELECT * FROM factors WHERE region = %s"
        cursor.execute(sql, (region,))
        return cursor.fetchall()


def get_most_used_factors(limit=10):
    with get_db() as conn:
        cursor = conn.cursor(dictionary=True)
        sql = "SELECT * FROM factors ORDER BY usage_count DESC LIMIT %s"
        cursor.execute(sql, (limit,))
        return cursor.fetchall()


def increment_usage_count(factor_id):
    with get_db() as conn:
        cursor = conn.cursor()
        sql = "UPDATE factors SET usage_count = usage_count + 1 WHERE id = %s"
        cursor.execute(sql, (factor_id,))
        conn.commit()
        return True


def update_factor(factor_id, data):
    # Ensure value_per_unit is float if provided
    if "value_per_unit" in data:
        data["value_per_unit"] = float(data["value_per_unit"])
    with get_db() as conn:
        cursor = conn.cursor()
        sql = "UPDATE factors SET name = %s, unit = %s, value_per_unit = %s, category = %s, region = %s, source = %s WHERE id = %s"
        values = (
            data["name"],
            data["unit"],
            data["value_per_unit"],
            data["category"],
            data["region"],
            data["source"],
            factor_id,
        )
        cursor.execute(sql, values)
        conn.commit()
        return True


def delete_factor(factor_id):
    with get_db() as conn:
        cursor = conn.cursor()
        sql = "DELETE FROM factors WHERE id = %s"
        cursor.execute(sql, (factor_id,))
        conn.commit()
        return True
