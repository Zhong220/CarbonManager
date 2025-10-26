# backend/routes/onchain.py
from flask import Blueprint, request, jsonify
from db_connection import get_db
import os, json

onchain_bp = Blueprint("onchain", __name__)

CHAIN_WEBHOOK_SECRET = os.getenv("CHAIN_WEBHOOK_SECRET", )  # set in .env 

# ---- Helper Functions ---- #
def fetch_emission(conn, emission_id: int): # Fetch emission details from DB
    cur = conn.cursor(dictionary=True)
    try:
        cur.execute("""
        SELECT e.id, e.product_id, e.stage_id, e.factor_id, e.tag_id, e.quantity, e.created_by, e.sort_order, e.created_at, p.organization_id, p.type_id, p.name AS product_name
        FROM emissions e
        JOIN products p ON p.id = e.product_id
        WHERE e.id = %s
        """, (emission_id,))
        return cur.fetchone()
    finally:
        cur.close()

def build_payload(em: dict) -> dict:        # Build payload for on-chain submission
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


# ---- API Endpoints ---- #
# POST: Create or update on-chain job for an emission
@onchain_bp.post("/onchain/emissions/<int:emission_id>")
def create_onchain_job(emission_id: int):
    body = request.get_json(silent=True) or {}
    with get_db() as conn:
        em = fetch_emission(conn, emission_id) 
        if not em:
            return jsonify(error="emission not found"), 404

        payload = build_payload(em)
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO emissions_onchain (emission_id, status, payload_json)
            VALUES (%s,'pending',%s)
            ON DUPLICATE KEY UPDATE
              status='pending',
              payload_json=VALUES(payload_json),
              error_msg=NULL
        """, (emission_id, json.dumps(payload, ensure_ascii=False)))
        conn.commit()
        cur.close()
    return jsonify(ok=True, emission_id=emission_id, status="pending", payload=payload), 201

# GET: Fetch on-chain status for an emission
@onchain_bp.get("/onchain/emissions/<int:emission_id>")
def get_onchain_status(emission_id: int):
    with get_db() as conn:
        cur = conn.cursor(dictionary=True)
        cur.execute("""
          SELECT emission_id, status, tx_hash, payload_json, error_msg, created_at, updated_at
          FROM emissions_onchain WHERE emission_id=%s
        """, (emission_id,))
        row = cur.fetchone()
        cur.close()
    if not row:
        return jsonify(error="no onchain record"), 404
    # parse json
    try:
        row["payload_json"] = json.loads(row["payload_json"]) if row["payload_json"] else None
    except Exception:
        pass
    return jsonify(row)

# PUT: Callback for chain-service to update status
@onchain_bp.put("/onchain/callback")
def onchain_callback():
    
    # ERROR 401: Verify secret header
    secret = request.headers.get("X-Chain-Secret")
    if secret != CHAIN_WEBHOOK_SECRET:
        return jsonify(error="unauthorized"), 401

    # ERROR 400: Parse JSON body
    data = request.get_json(force=True)
    status = (data.get("status") or "").lower()
    if status not in ("submitted", "confirmed", "failed"):
        return jsonify(error="invalid status"), 400

    # ERROR 400: Either emission_id or tx_hash must be provided
    emission_id = data.get("emission_id")
    tx_hash = data.get("tx_hash")
    error_msg = data.get("error_msg")
    if not emission_id and not tx_hash:
        return jsonify(error="emission_id or tx_hash required"), 400

    # Update DB record
    affected = 0 # number of rows affected
    with get_db() as conn:
        cur = conn.cursor()
        if emission_id:
            cur.execute("""
                UPDATE emissions_onchain
                SET status=%s, tx_hash=COALESCE(%s, tx_hash), error_msg=%s
                WHERE emission_id=%s
            """, (status, tx_hash, error_msg, emission_id))
        else:
            cur.execute("""
                UPDATE emissions_onchain
                SET status=%s, error_msg=%s 
                WHERE tx_hash=%s
            """, (status, error_msg, tx_hash))
        conn.commit()
        affected = cur.rowcount
        cur.close()

    # ERROR 404: If no rows affected, record not found
    if affected == 0:
        return jsonify(error="onchain record not found"), 404
    
    return jsonify(ok=True)
