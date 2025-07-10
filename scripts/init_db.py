import os
import mysql.connector

path = 'scripts/schema.sql'

def run_sql_script(path):
    with open(path, 'r') as f:
        sql_script = f.read()
        
    conn = mysql.connector.connect(
        host=os.getenv('DB_HOST'),
        user=os.getenv('DB_USER'),
        password=os.getenv('DB_PASSWORD'),
        database=os.getenv('DB_NAME'),
        auth_plugin='caching_sha2_password'  # Use modern authentication
    )
    cursor = conn.cursor()

    # Split the SQL script into individual statements and execute them
    for stmt in sql_script.strip().split(';'):
        if stmt.strip():
            cursor.execute(stmt)
    conn.commit()
    cursor.close()
    conn.close()
    
    print(f"Successfully executed {path}")

if __name__ == "__main__":
    run_sql_script(path) 