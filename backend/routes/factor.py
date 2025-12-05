# backend/routes/factor.py
from flask import Blueprint, request, jsonify
from flask_jwt_extended import (
    get_jwt_identity,
    jwt_required,
)
from models.factor_model import (
    search_factors,
)

factor_bp = Blueprint("factors", __name__, url_prefix="/factors")



@factor_bp.route("", methods=["GET"])
@jwt_required()
def get_factors():
    q = request.args.get("q")
    category = request.args.get("category")
    mid = request.args.get("midcategory")
    sub = request.args.get("subcategory")
    unit = request.args.get("unit")
    limit = int(request.args.get("limit", 20))
    offset = int(request.args.get("offset", 0))

    factors = search_factors(
        q=q,
        category=category,
        midcategory=mid,
        subcategory=sub,
        unit=unit,
        limit=limit,
        offset=offset,
    )

    return jsonify({"factors": factors})