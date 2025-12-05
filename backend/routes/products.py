# backend/routes/products.py
from flask import Blueprint, jsonify, request
from flask_jwt_extended import (
    get_jwt_identity,
    jwt_required,
)
from routes.emissions import product_emission_bp  
from models.user_model import get_user_organization
from models.products_model import(
                        list_products, 
                        fetch_product, 
                        create_product, 
                        update_product, 
                        delete_product
                        )
from models.steps_model import( 
                        get_steps_under_product_stage, 
                        create_steps,
                        )

from routes.helpers import display_id, parse_display_id, json_response

# Blueprint for product routes under a product type
product_types_products_bp = Blueprint('products', __name__)

# Blueprint for product routes
product_bp = Blueprint("product_bp", __name__, url_prefix="/products")    
product_bp.register_blueprint(product_emission_bp, url_prefix="/<string:product_id>") 

# -------- Products under a Product Type routes --------
@product_types_products_bp.get("products")
@jwt_required()
def get_all(product_type_id):
    uid = int(get_jwt_identity())
    org = get_user_organization(uid)
    org_id = org["id"]
    rows = list_products(org_id, parse_display_id(product_type_id, "PRT"))  
    products = []
    for r in rows:
        products.append({
            "product_id": display_id("products", r["id"]),
            "product_name": r["name"],
            "serial_number": r["serial_number"],
            "total_emission": r["total_emission"],
            # "created_at": r["created_at"].isoformat(),
            # "ended_at": r["ended_at"].isoformat(),
            "code": r["code"],
        })
    return json_response({"products": products}, 200)


@product_types_products_bp.post("/products")
@jwt_required()
def create(product_type_id):
    uid = int(get_jwt_identity())
    org = get_user_organization(uid)
    org_id = org["id"]
    data = request.get_json()
    name = data.get("name")
    serial_number = data.get("serial_number")
    code = data.get("code")
    create_product(org_id, parse_display_id(product_type_id, "PRT"), name, serial_number, code)
    return json_response({"message": "Product created"}, 201)


# ------------- By Product ID routes --------------
@product_bp.get("")
@jwt_required()
def get(product_id):
    pd = fetch_product(parse_display_id(product_id), "PRD")
    if not pd:
        return jsonify({"error": "Product not found"}), 404
    return json_response({
        "product_id": display_id("products", pd["id"]),
        "product_name": pd["name"],
        "product_type_id": display_id("product_types", pd["type_id"]),
        }, 200)

@product_bp.put("")
@jwt_required()
def update(product_id):
    data = request.get_json()
    organization_id = parse_display_id(data.get("organization_id"), "ORG")
    product_type_id = parse_display_id(data.get("product_type_id"), "PRT")
    name = data.get("new_product_name")
    serial_number = data.get("serial_number")
    code = data.get("code")
    update_product(parse_display_id(product_id, "PRD"), organization_id, product_type_id, name, serial_number, code)
    return json_response({"message": "Product updated"}, 200)


@product_bp.delete("")
@jwt_required()
def delete(product_id):
    delete_product(parse_display_id(product_id), "PRD")
    return json_response({"message": "Product deleted"}, 200)


# -------- By Product Id: Steps under a Product --------
@product_bp.get("<string:product_id>/steps/<string:stage_id>")
@jwt_required()
def get_steps(product_id, stage_id):
    rows = get_steps_under_product_stage(parse_display_id(product_id, "PRD"), stage_id)
    steps = []
    for r in rows:
        steps.append({
            "step_id": display_id("steps", r["id"]),
            "step_name": r["name"],
            "tag_id": display_id("tags", r["tag_id"]),
            "sort_order": r["sort_order"],
            "created_at": r["created_at"].isoformat(),
        })
    return json_response(steps, 200)

@product_bp.post("<string:product_id>/steps")
@jwt_required()
def create(product_id):
    data = request.get_json()
    name = data.get("name")
    stage_id = data.get("stage_id")
    tag_id = parse_display_id(data.get("tag_id"), "TAG")
    sort_order = data.get("sort_order")
    create_steps(parse_display_id(product_id, "PRD"), stage_id , tag_id, name, sort_order)  
    return json_response({"message": "Step created under product"}, 201)
