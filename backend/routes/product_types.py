# backend/routes/product_types.py
from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from models.product_types_model import (
    create_product_type,
    get_product_type_by_id,
    delete_product_type,
    list_product_types,
    modify_product_type,
)
from models.user_model import get_user_organization
from mysql.connector.errors import IntegrityError
from routes.products import product_types_products_bp 

product_types_bp = Blueprint("product_types", __name__, url_prefix="/product_types")  
product_types_bp.register_blueprint(product_types_products_bp, url_prefix="/<int:type_id>") 

# -------------- Helpers --------------
def _is_shop(claims: dict) -> bool:
    return (claims.get("user_type") or "").lower() == "shop"


def _validate_name(name: str) -> str | None:
    if not name:
        return "name is required"
    if len(name) > 100:
        return "name must be at most 100 characters"
    return None


# -------- All: Create product type --------
@product_types_bp.post("")
@jwt_required()
def add_type():
    uid = int(get_jwt_identity())
    org = get_user_organization(uid)
    if not org:
        return jsonify(error="user has no organization"), 400

    data = request.get_json(force=True)
    name = data.get("name")
    err = _validate_name(name)
    if err:
        return jsonify(error=err), 400
    try:
        new_id = create_product_type(organization_id=org["id"], name=name)
        row = get_product_type_by_id(org["id"], new_id)
        return jsonify(row), 201
    except IntegrityError:
        return jsonify(error="Product type with this name already exists"), 409
    except Exception as e:
        return jsonify(error="Error creating product type", details=str(e)), 500


# -------- All: List product types --------
@product_types_bp.get("")
@jwt_required()
def list_all():

    uid = int(get_jwt_identity())
    org = get_user_organization(uid)
    if not org:
        return jsonify(error="user has no organization"), 400
    org_id = org["id"]
    try:
        pts = list_product_types(org_id)
        return jsonify(product_types=pts), 200
    except Exception as e:
        return jsonify(msg="Error fetching product types", error=str(e)), 500

# -------- By id: Update a product type --------
@product_types_bp.put("/<int:product_type_id>")
@jwt_required()
def update_pt(product_type_id):
    uid = int(get_jwt_identity())
    org = get_user_organization(uid)
    if not org:
        return jsonify(error="user has no organization"), 400
    org_id = org["id"]
    data = request.get_json()
    new_name = (data.get("name") or "").strip()
    if not new_name:
        return jsonify(msg="New name must be provided"), 400
    try:
        success = modify_product_type(new_name, org_id, product_type_id)
        if success:
            return jsonify(msg="Product type updated"), 200
        else:
            return jsonify(msg="Product type not found"), 404
    except Exception as e:
        return jsonify(msg="Error updating product type", error=str(e)), 500


# -------- By id: Delete a product type --------
@product_types_bp.delete("/<int:product_type_id>")
@jwt_required()
def delete_pt(product_type_id):
    uid = int(get_jwt_identity())
    org = get_user_organization(uid)
    if not org:
        return jsonify(error="user has no organization"), 400
    org_id = org["id"]
    try:
        res = get_product_type_by_id(org_id, product_type_id)  # perserve for response
        success = delete_product_type(org_id, product_type_id)
        if success:
            return (
                jsonify(
                    product_type_id, 
                    product_type_name = res["name"],
                    order_id = res["order_id"],
                    status_message="Product type deleted"
                ), 
                200,
            )
        else:
            return jsonify(status_message="Product type not found"), 404
    except Exception as e:
        return jsonify(status_message="Error deleting product type", error=str(e)), 500


# -------- By id: Get a product type ----------
@product_types_bp.get("/<int:product_type_id>")
@jwt_required()
def get_pt(product_type_id):
    uid = int(get_jwt_identity())
    org = get_user_organization(uid)
    if not org:
        return jsonify(error="user has no organization"), 400
    org_id = org["id"]
    try:
        pt = get_product_type_by_id(org_id, product_type_id)
        if pt:
            return jsonify(product_type=pt), 200
        else:
            return jsonify(msg="Product type not found"), 404
    except Exception as e:
        return jsonify(msg="Error fetching product type", error=str(e)), 500
