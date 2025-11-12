# backend/store_stages/seed_stages.py
import json
from typing import List, Dict
from db_connection import get_db

JSON_PATH = "store_tags/tags.json"

# There is stages in db, just need to seed tags under each stage
def load_json_data():
    with open(JSON_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


# Seed tags into the database
def seed_tags():
    data = load_json_data()
    with get_db() as conn:
        cursor = conn.cursor()
        for stage in data:
            stage_id = stage["id"]
            for tag_name in stage["allowedTags"]:
                sql = """
                    INSERT INTO tags (stage_id, name)
                    VALUES (%s, %s)
                """
                cursor.execute(sql, (stage_id, tag_name))        

        conn.commit()
        cursor.close()


if __name__ == "__main__":
    seed_tags()
    print("Seeding tags completed.")
