# backend/helpers.py

import json
from flask import Response

PREFIXES = {
    "users": "USR",
    "product_types": "PT",
    "products": "PRD",
    "emissions": "EMS",
    "stages": "STG",
    "steps": "STP",
    "tags": "TAG",
    "organizations": "ORG",
}

def display_id(table: str, numeric_id: int) -> str:
    return f"{PREFIXES[table]}{numeric_id}"

def parse_display_id(value: str, expected_prefix: str) -> int:
    if not value.startswith(expected_prefix):
        raise ValueError(f"Invalid ID prefix: expected {expected_prefix}")

    suffix = value[len(expected_prefix):]
    if not suffix.isdigit():
        raise ValueError("Display ID must end with digits")

    return int(suffix)


def json_response(data, status=200):
    """
    Returns a JSON response with preserved key order.
    This bypasses Flask's jsonify() so keys will NOT be re-sorted.
    """
    body = json.dumps(
        data,
        ensure_ascii=False,
        sort_keys=False,   # Make sure the response is sorted as desired
    )
    return Response(body, mimetype="application/json", status=status)


# Validators
def _is_shop(claims: dict) -> bool:
    return (claims.get("user_type") or "").lower() == "shop"


def _validate_name(name: str) -> str | None:
    if not name:
        return "name is required"
    if len(name) > 100:
        return "name must be at most 100 characters"
    return None
