# backend/routes/product_types.py
from flask import Blueprint, request
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
from routes.helpers import(
    display_id, 
    parse_display_id,
    _is_shop,
    _validate_name,
    json_response
)

product_types_bp = Blueprint("product_types", __name__, url_prefix="/product_types")  
product_types_bp.register_blueprint(product_types_products_bp, url_prefix="/<int:type_id>") 

@product_types_bp.post("")
@jwt_required()
def add_type():
    uid = int(get_jwt_identity())
    org = get_user_organization(uid)
    if not org:
        return json_response({"error 400": "user has no organization"}, 400)
    data = request.get_json(force=True)
    name = data.get("name")
    err = _validate_name(name)
    if err:
        return json_response(error=err, status=400)
    try:
        new_id = create_product_type(organization_id=org["id"], name=name)
        pt = get_product_type_by_id(org["id"], new_id)
        return json_response({
                "product_type_id": display_id("product_types", new_id),
                "product_type_name": pt["name"],
                "organization_id": display_id("organizations", org["id"]),
                "organization_name": pt["organization_name"],  
                "created_at": pt["created_at"], 
                "updated_at": pt["updated_at"],
                "order_id": pt["order_id"]
                }
            , status=201)
    except IntegrityError:
        return json_response({"error 409": "Product type with this name already exists"}, status=409)
    except Exception as e:
        return json_response({"error": "Error creating product type, details: %e"}, e, 500)

@product_types_bp.get("")
@jwt_required()
def list_all():

    uid = int(get_jwt_identity())
    org = get_user_organization(uid)
    if not org:
        return json_response({"error 400": "user has no organization"}, 400)
    org_id = org["id"]
    try:
        pts = list_product_types(org_id)
        for row in pts:
            row["product_type_id"] = display_id("product_types", row["id"])
            row["organization_id"] = display_id("organizations", row["organization_id"])
            row.pop("id", None)
        return json_response(product_types=pts), 200
    except Exception as e:
        return json_response({"error 500": f"{e}"}, 500)

@product_types_bp.put("/<string:product_type_id>")
@jwt_required()
def update_pt(product_type_id):
    product_type_id_int = parse_display_id(product_type_id, "PT")
    uid = int(get_jwt_identity())
    org = get_user_organization(uid)
    if not org:
        return json_response({"error 400": "user has no organization"}, 400)
    org_id = org["id"]
    data = request.get_json()
    new_name = (data.get("name") or "").strip()
    if not new_name:
        return json_response({"error 400": "New name must be provided"}, 400)
    try:
        success = modify_product_type(new_name, org_id, product_type_id_int)
        if success:
            return json_response(msg="Product type updated"), 200
        else:
            return json_response(msg="Product type not found"), 404
    except Exception as e:
        return json_response({"error 500": f"{e}"}, 500)

@product_types_bp.delete("/<string:product_type_id>")
@jwt_required()
def delete_pt(product_type_id):
    uid = int(get_jwt_identity())
    org = get_user_organization(uid)
    if not org:
        return jsonify(error="user has no organization"), 400
    org_id = org["id"]
    try:
        product_type_id_int = parse_display_id(product_type_id, "PT")
        pt = get_product_type_by_id(org_id, product_type_id_int)
        success = delete_product_type(org_id, product_type_id_int)
        if success:
            return json_response(
                {
                    "status_message": "Product type deleted",
                    "product_type_id": product_type_id,
                    "product_type_name": pt["name"],
                    "order_id": pt["order_id"],   
                }, 200)

        else:
            return json_response({"error 404": "Product type not found"}, 404)
    except Exception as e:
        return json_response({"error 500": f"{e}"}, 500)


# -------- By id: Get a product type ----------
@product_types_bp.get("/<string:product_type_id>")
@jwt_required()
def get_pt(product_type_id):
    uid = int(get_jwt_identity())
    org = get_user_organization(uid)
    if not org:
        return json_response({"error 400": "user has no organization"}, 400)
    org_id = org["id"]
    try:
        pt = get_product_type_by_id(org_id, parse_display_id(product_type_id, "PT"))
        if pt:
            pt["product_type_id"] = product_type_id
            pt["organization_id"] = display_id("organizations", org["id"])
            pt.pop("id", None)
            return json_response(product_type=pt), 200
        else:
            return json_response({"error 404": "Product type not found"}, 404)
    except Exception as e:
        return json_response({"error 500": f"{e}"}, 500)
