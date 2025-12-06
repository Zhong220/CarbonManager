# backend/store_factors/seed_factors.py
import json
from decimal import Decimal
from db_connection import get_db


JSON_PATH = "store_factors/emissionFinal.json"


def parse_coefficient(raw_value: str) -> float:
    if not raw_value:
        return None
    # keep only numeric/scientific part before space
    token = raw_value.split()[0]
    try:
        return float(Decimal(token))
    except Exception:
        return None


def load_json_data():
    with open(JSON_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def seed_factors():
    data = load_json_data()
    with get_db() as conn:
        cursor = conn.cursor()

        sql = """
        INSERT INTO factors (
            name,
            coefficient,
            unit,
            announcement_year,
            category,
            subcategory,
            midcategory,
            source
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        ON DUPLICATE KEY UPDATE
            coefficient = VALUES(coefficient),
            announcement_year = VALUES(announcement_year),
            category = VALUES(category),
            subcategory = VALUES(subcategory),
            midcategory = VALUES(midcategory),
            source = VALUES(source);
        """

        rows = []
        for item in data:
            name = item.get("name")
            coefficient = parse_coefficient(item.get("coe"))
            unit = item.get("unit")
            year = int(item["announcementyear"]) if item.get("announcementyear") else None
            category = item.get("category")
            subcategory = item.get("subcategory")
            midcategory = item.get("midcategory")
            source = "環境部"

            rows.append((
                name,
                coefficient,
                unit,
                year,
                category,
                subcategory,
                midcategory,
                source
            ))

        cursor.executemany(sql, rows)
        conn.commit()

    print(f"✅ Seeded {len(rows)} emission factors into DB.")


if __name__ == "__main__":
    seed_factors()
