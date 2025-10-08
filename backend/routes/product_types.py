# backend/routes/product_types.py
from flask import Blueprint, request, jsonify
from flask_jwt_extended import (
    jwt_required, get_jwt_identity, get_jwt
)
from mysql.connector.errors import IntegrityError
# from werkzeug.security import generate_password_hash, check_password_hash
from db_connection import get_db
from models.organizations_model import (
    get_organization_by_id
)
from models.user_model import (
    get_user_by_id, get_user_organization
)
from models.product_types_model import (
    create_product_type as m_create_type,
    get_product_types_by_org,
    modify_product_type,
    delete_product_type,
    get_product_type_by_id as m_get_type,
)


product_types_bp = Blueprint('product_types', __name__, url_prefix='/product_types') # all routes start with /product_types

# -------------- Helper Functions --------------
def _is_shop(claims: dict) -> bool:
    return (claims.get("user_type") or "").lower() == "shop"

def _validate_name(name: str) -> str | None:
    if not name:
        return "name is required"
    if len(name) > 100:
        return "name must be at most 100 characters"
    return None

# -------- POST: CREATE PRODUCT TYPE --------
@product_types_bp.post('/')
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
        new_id = m_create_type(organization_id=org["id"],name=name )
        row = m_get_type(org["id"], new_id)
        return jsonify(row), 201
    except IntegrityError as ie:
        return jsonify(error="Product type with this name already exists"), 409
    except Exception as e:
        return jsonify(error="Error creating product type", details=str(e)), 500    

# -------- LIST PRODUCT TYPES BY ORG ID --------
@product_types_bp.get('/')
@jwt_required()
def list_product_types():
    
    uid = int(get_jwt_identity())
    org = get_user_organization(uid)
    if not org:
        return jsonify(error="user has no organization"), 400
    org_id = org["id"] 
    try:
        pts = get_product_types_by_org(org_id)
        return jsonify(product_types=pts), 200
    except Exception as e:
        return jsonify(msg="Error fetching product types", error=str(e)), 500
    

# -- ------ MODIFY A PRODUCT --------
@product_types_bp.put('/<int:product_type_id>')
@jwt_required()
def update_pt(product_type_id):
    uid = int(get_jwt_identity())
    org = get_user_organization(uid)
    if not org:
        return jsonify(error="user has no organization"), 400
    org_id = org["id"]
    data = request.get_json()
    new_name = (data.get('name') or '').strip() 
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

# -------------- DELETE A PRODUCT TYPE 
@product_types_bp.delete('/<int:product_type_id>')
@jwt_required()
def delete_pt(product_type_id):
    uid = int(get_jwt_identity())
    org = get_user_organization(uid)
    if not org:
        return jsonify(error="user has no organization"), 400
    org_id = org["id"]
    try:
        success = delete_product_type(org_id, product_type_id)
        if success:
            return jsonify(msg="Product type deleted"), 200
        else:
            return jsonify(msg="Product type not found"), 404
    except Exception as e:
        return jsonify(msg="Error deleting product type", error=str(e)), 500
    
# ---------------- GET A PRODUCT TYPE BY ID
@product_types_bp.get('/<int:product_type_id>')
@jwt_required()
def get_pt(product_type_id):
    uid = int(get_jwt_identity())
    org = get_user_organization(uid)
    if not org:
        return jsonify(error="user has no organization"), 400
    org_id = org["id"]
    try:
        pt = m_get_type(org_id, product_type_id)
        if pt:
            return jsonify(product_type=pt), 200
        else:
            return jsonify(msg="Product type not found"), 404
    except Exception as e:
        return jsonify(msg="Error fetching product type", error=str(e)), 500
