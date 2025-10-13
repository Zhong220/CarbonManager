# backend/routes/onchain.py
from __future__ import annotations
import os, json, requests
from flask import Blueprint, request, jsonify
from models.chain_model import (
    fetch_emission,
    build_payload,
    upsert_pending,    
    get_status, 
    set_status_by_tx,        
)

onchain_bp = Blueprint("onchain", __name__)

CHAIN_SERVICE_URL    = os.getenv("CHAIN_SERVICE_URL", )
CHAIN_WEBHOOK_SECRET = os.getenv("CHAIN_WEBHOOK_SECRET", None)
DEFAULT_TIMEOUT      = (3, 20)  # (connect, read)


def send_emission_to_chain(*, emission_id: int, payload: dict) -> dict:
    url = f"{CHAIN_SERVICE_URL.rstrip('/')}/send"
    resp = requests.post(url, json={"emission_id": emission_id, "payload": payload}, timeout=DEFAULT_TIMEOUT)
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
        return jsonify(ok=True, emission_id=emission_id, chain_response=chain_resp), 202    #Expect to get the hash

    except requests.HTTPError as he:
        return jsonify(
            error="chain-service HTTP error",
            details=str(he),
            body=getattr(he.response, "text", ""),
        ), 502
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

    tx_hash     = data.get("tx_hash")
    error_msg   = data.get("error_msg")

    if not tx_hash:
        return jsonify(error="tx_hash required"), 400

    try:
        affected = set_status_by_tx(tx_hash=tx_hash, status="confirmed", error_msg=error_msg)
    except Exception as e:
        return jsonify(error="db update failed", details=str(e)), 500

    if affected == 0:
        return jsonify(error="onchain record not found"), 404

    return jsonify(ok=True), 200
