# backend/routes/onchain.py
from __future__ import annotations

import os

from db_connection import get_db

import requests
from flask import Blueprint, jsonify, request
from models.chain_model import (
    build_payload,
    fetch_emission,
    get_status,
    set_status_by_tx,
    upsert_pending,
)

onchain_bp = Blueprint("onchain", __name__)

CHAIN_SERVICE_URL = os.getenv(
    "CHAIN_SERVICE_URL",
)
CHAIN_WEBHOOK_SECRET = os.getenv("CHAIN_WEBHOOK_SECRET", None)
DEFAULT_TIMEOUT = (3, 20)  # (connect, read)


def send_emission_to_chain(*, emission_id: int, payload: dict) -> dict:
    url = f"{CHAIN_SERVICE_URL.rstrip('/')}/send"
    resp = requests.post(
        url,
        json={"emission_id": emission_id, "payload": payload},
        timeout=DEFAULT_TIMEOUT,
    )
    resp.raise_for_status()
    return resp.json()


# POST: Subit one emission to the chain service
@onchain_bp.post("/onchain/emissions/<int:emission_id>")
def submit_to_chain(emission_id: int):
    #  fetch + build payload
    em = fetch_emission(emission_id)
    if not em:
        return jsonify(error="emission not found"), 404
    payload = build_payload(em)

    #  Pending job exists with current emission
    try:
        upsert_pending(emission_id)
    except Exception as e:
        return jsonify(error="failed to persist pending job", details=str(e)), 500

    # Call chain-service
    try:
        chain_resp = send_emission_to_chain(emission_id=emission_id, payload=payload)
        # Receive the hash from chain and save in db, satus now is submitted.
        # set status by tx
        return (
            jsonify(ok=True, emission_id=emission_id, chain_response=chain_resp),
            202,
        )  # Expect to get the hash

    except requests.HTTPError as he:
        return (
            jsonify(
                error="chain-service HTTP error",
                details=str(he),
                body=getattr(he.response, "text", ""),
            ),
            502,
        )
    except requests.RequestException as re:
        return jsonify(error="chain-service unreachable", details=str(re)), 502


# GET: Check the status of the emission onchain
@onchain_bp.get("/onchain/emissions/<int:emission_id>")
def get_onchain_status_route(emission_id: int):
    row = get_status(emission_id)
    if not row:
        return jsonify(error="no onchain record"), 404
    return jsonify(row), 200


# PUT: Call back from chain service
@onchain_bp.put("/onchain/callback")
def onchain_callback():
    secret = request.headers.get("X-Chain-Secret")
    if not CHAIN_WEBHOOK_SECRET or secret != CHAIN_WEBHOOK_SECRET:
        return jsonify(error="unauthorized"), 401

    data = request.get_json(force=True)
    emission_id = data.get("emission_id")
    tx_hash = data.get("tx_hash")
    error_msg = data.get("error_msg")
    status = data.get("status", "confirmed")

    if not emission_id and not tx_hash:
        return jsonify(error="emission_id or tx_hash required"), 400

    # with get_db() as conn:
    #     cur = conn.cursor()
    #     cur.execute("SELECT emission_id FROM emissions_onchain WHERE tx_hash=%s", (tx_hash,))
    #     conn.commit()

    try:
        with get_db() as conn:
            cur = conn.cursor()
            affected = 0
            if tx_hash:
                # ✅ 優先以 tx_hash 更新（若後續重送）
                cur.execute(
                    """
                    UPDATE emissions_onchain
                    SET status=%s, error_msg=%s, updated_at=NOW()
                    WHERE tx_hash=%s
                    """,
                    (status, error_msg, tx_hash),
                )
                affected = cur.rowcount

            # ✅ 若沒找到（或 tx_hash 為 None），就用 emission_id 更新並補上 tx_hash
            if not tx_hash or affected == 0:
                cur.execute(
                    """
                    UPDATE emissions_onchain
                    SET tx_hash=%s, status=%s, error_msg=%s, updated_at=NOW()
                    WHERE emission_id=%s
                    """,
                    (tx_hash, status, error_msg, emission_id),
                )
                affected = cur.rowcount

            conn.commit()
            cur.close()

    except Exception as e:
        return jsonify(error="db update failed", details=str(e)), 500

    if affected == 0:
        return jsonify(error="onchain record not found"), 404

    return jsonify(ok=True, emission_id=emission_id, tx_hash=tx_hash, status=status), 200


# # PUT: Call back from chain service
# @onchain_bp.put("/onchain/callback")
# def onchain_callback():
#     secret = request.headers.get("X-Chain-Secret")
#     if not CHAIN_WEBHOOK_SECRET or secret != CHAIN_WEBHOOK_SECRET:
#         return jsonify(error="unauthorized"), 401

#     data = request.get_json(force=True)
#     emission_id = data.get("emission_id")
#     tx_hash = data.get("tx_hash")
#     error_msg = data.get("error_msg")

#     if not tx_hash:
#         return jsonify(error="tx_hash required"), 400

#     try:
#         affected = set_status_by_tx(
#             tx_hash=tx_hash, status="confirmed", error_msg=error_msg
#         )
#     except Exception as e:
#         return jsonify(error="db update failed", details=str(e)), 500

#     if affected == 0:
#         return jsonify(error="onchain record not found"), 404

#     return jsonify(ok=True), 200
