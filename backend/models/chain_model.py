# backend/models/chain_model.py
from db_connection import get_db

##################################### emissions_onchain ###########################
# +--------------+--------------------------------------------------+------+-----+-------------------+-----------------------------------------------+
# | Field        | Type                                             | Null | Key | Default           | Extra                                         |
# +--------------+--------------------------------------------------+------+-----+-------------------+-----------------------------------------------+
# | id           | bigint unsigned                                  | NO   | PRI | NULL              | auto_increment                                |
# | emission_id  | bigint unsigned                                  | NO   | UNI | NULL              |                                               |
# | status       | enum('pending','submitted','confirmed','failed')  | NO   | MUL | pending           |                                               |
# | tx_hash      | varchar(66)                                      | YES  | UNI | NULL              |                                               |
# | error_msg    | varchar(500)                                     | YES  |     | NULL              |                                               |
# | created_at   | timestamp                                        | NO   |     | CURRENT_TIMESTAMP | DEFAULT_GENERATED                             |
# | updated_at   | timestamp                                        | NO   | MUL | CURRENT_TIMESTAMP | DEFAULT_GENERATED on update CURRENT_TIMESTAMP |
# +--------------+--------------------------------------------------+------+-----+-------------------+-----------------------------------------------+


def fetch_emission(emission_id: int):
    sql = """
        SELECT
            e.id,
            e.product_id,
            e.stage_id,
            e.factor_id,
            e.tag_id,
            e.quantity,
            e.created_by,
            e.sort_order,
            e.created_at,
            p.organization_id,
            p.type_id,
            p.name AS product_name
        FROM emissions e
        JOIN products p ON p.id = e.product_id
        WHERE e.id = %s
        LIMIT 1
    """
    with get_db() as conn:
        cur = conn.cursor(dictionary=True)
        try:
            cur.execute(sql, (emission_id,))
            return cur.fetchone()
        finally:
            cur.close()


def build_payload(em: dict) -> dict:
    return {
        "emission_id": em["id"],
        "product_id": em["product_id"],
        "organization_id": em["organization_id"],
        "stage_id": em["stage_id"],
        "factor_id": em["factor_id"],
        "tag_id": em["tag_id"],
        "quantity": em["quantity"],
        "created_by": em["created_by"],
        "sort_order": em["sort_order"],
        "product_name": em["product_name"],
        "timestamp": em["created_at"].isoformat() if em["created_at"] else None,
    }


def upsert_pending(emission_id: int) -> None:
    sql = """
        INSERT INTO emissions_onchain (emission_id, status)
        VALUES (%s,'pending')
        ON DUPLICATE KEY UPDATE
            status='pending',
            error_msg=NULL
        """
    with get_db() as conn:
        cur = conn.cursor()
        try:
            cur.execute(sql, (emission_id,))
            conn.commit()
        finally:
            cur.close()


def get_status(emission_id: int) -> dict | None:
    sql = """
        SELECT
            id,
            emission_id,
            status,
            tx_hash,
            error_msg,
            created_at,
            updated_at
        FROM emissions_onchain
        WHERE emission_id = %s
        """
    with get_db() as conn:
        cur = conn.cursor(dictionary=True)
        try:
            cur.execute(sql, (emission_id,))
            return cur.fetchone()
        finally:
            cur.close()


def set_status_by_tx(tx_hash: str, *, status: str, error_msg: str | None) -> int:
    sql = """
        UPDATE emissions_onchain
        SET status=%s,
            error_msg=%s
        WHERE tx_hash=%s
    """
    with get_db() as conn:
        cur = conn.cursor()
        try:
            cur.execute(sql, (status, error_msg, tx_hash))
            conn.commit()
            return cur.rowcount
        finally:
            cur.close()
