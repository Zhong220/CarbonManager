from backend.database import get_db

PRODUCT_COLLECTION = 'products'

def create_product(name, description, user_id):
    with get_db() as conn:
        cursor = conn.cursor(dictionary=True)
        sql = """
            INSERT INTO products (name, description, user_id)
            VALUES (%s, %s, %s)
        """
        values = (name, description, user_id)
        cursor.execute(sql, values)
        conn.commit()
        return cursor.lastrowid

def get_product(product_id):
    with get_db() as conn:
        cursor = conn.cursor(dictionary=True)
        sql = "SELECT * FROM products WHERE id = %s"
        cursor.execute(sql, (product_id,))
        return cursor.fetchone()

def get_products_by_user(user_id):
    with get_db() as conn:
        cursor = conn.cursor(dictionary=True)
        sql = "SELECT * FROM products WHERE user_id = %s"
        cursor.execute(sql, (user_id,))
        return cursor.fetchall()

def update_product(product_id, data):
    with get_db() as conn:
        cursor = conn.cursor()
        sql = "UPDATE products SET name = %s, description = %s WHERE id = %s"
        values = (data['name'], data['description'], product_id)
        cursor.execute(sql, values)
        conn.commit()
        return True

def delete_product(product_id):
    with get_db() as conn:
        cursor = conn.cursor()
        sql = "DELETE FROM products WHERE id = %s"
        cursor.execute(sql, (product_id,))
        conn.commit()
        return True
