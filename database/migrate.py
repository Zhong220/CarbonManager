import os
import sys
from pathlib import Path
import Config from config
import mysql.connector

# ---- Config (env with sensible defaults for local) ----
DB_HOST = os.getenv("DB_HOST", "db")
DB_PORT = int(os.getenv("DB_PORT", "3306"))
DB_USER = os.getenv("DB_USER", "carbon")
DB_PASS = os.getenv("DB_PASS", "carbonpass")
DB_NAME = os.getenv("DB_NAME", "carbon_manager")

MIGRATIONS_DIR = Path(__file__).parent / "migrations"

def connect(db=DB_NAME):
    try:
        return mysql.connector.connect(
            host=DB_HOST,
            port=DB_PORT,
            user=DB_USER,
            password=DB_PASS,
            database=db,
            auth_plugin="caching_sha2_password",
        )
    except mysql.connector.Error as e:
        print(f"[ERROR] Could not connect to MySQL at {DB_HOST}:{DB_PORT} ({e})")
        sys.exit(1)


def ensure_migrations_table(cur):
    cur.execute("""
        CREATE TABLE IF NOT EXISTS schema_migrations (
          id INT AUTO_INCREMENT PRIMARY KEY,
          filename VARCHAR(255) NOT NULL,
          applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    """)

def applied_set(cur):
    cur.execute("SELECT filename FROM schema_migrations")
    return {row[0] for row in cur.fetchall()}

def apply_sql_file(cur, path: Path):
    sql = path.read_text(encoding="utf-8")
    # Use multi=True so we don't manually split on semicolons
    for _ in cur.execute(sql, multi=True):
        pass

def main(target: str | None = None):
    if not MIGRATIONS_DIR.exists():
        print(f"Missing migrations dir: {MIGRATIONS_DIR}")
        sys.exit(1)

    conn = connect()
    cur = conn.cursor()

    ensure_migrations_table(cur)
    already = applied_set(cur)

    # Choose files to apply
    files = sorted([p for p in MIGRATIONS_DIR.iterdir() if p.suffix == ".sql"], key=lambda p: p.name)
    if target:
        # apply up to and including target filename
        files = [p for p in files if p.name <= target]

    todo = [p for p in files if p.name not in already]
    if not todo:
        print("No new migrations.")
        cur.close(); conn.close()
        return

    print("Applying migrations:")
    for path in todo:
        print(f"  -> {path.name}")
        apply_sql_file(cur, path)
        cur.execute("INSERT INTO schema_migrations (filename) VALUES (%s)", (path.name,))
        conn.commit()

    print("Done.")
    cur.close(); conn.close()

if __name__ == "__main__":
    # optional: allow `python migrate.py 003_seed_tags.sql`
    target = sys.argv[1] if len(sys.argv) > 1 else None
    main(target)
