# backend/routes/emissions.py
from flask import Blueprint, request, jsonify
from flask_jwt_extended import (
    get_jwt_identity,
    jwt_required,
)
    
from models.user_model import get_user_organization
from models.product_types_model import get_product_type_by_id
from models.products_model import fetch_product
from models.emissions_model import (
    get_emissions_by_org,
    get_emissions_by_product_and_stage,
    get_emissions_by_product,
    get_emission,
    create_emission,
    update_emission_quantity,
    delete_emission,
    get_emission_summary,
)

from routes.helpers import json_response, parse_display_id, display_id


product_emission_bp = Blueprint("emissions", __name__, url_prefix="/emissions")
emission_bp = Blueprint("emissions", __name__, url_prefix="/emissions")

# Product Emissions routes 
# -------- GET: List emissions from one product --------
@product_emission_bp.get("emissions")
@jwt_required()
def get_all(product_id):    
    rows = get_emissions_by_product(product_id)
    emissions = []
    for r in rows:
        emissions.append({
            "emission_id": r["id"],
            "emission_name": r["name"],
            "stage_id": r["stage_id"],
            "step_id": r["step_id"],
            "tag_id": r["tag_id"],
            "factor_id": r["factor_id"],
            "quantity": r["quantity"],
            "emission_amount": r["emission_amount"],
            "created_at": r["created_at"].isoformat(),
            "created_by": r["created_by"],
        })
    return json_response({"emissions": emissions}, 200)

# -------- POST: Create emission record for a product --------
@product_emission_bp.post("emissions")
@jwt_required()
def create(product_id):
    uid = int(get_jwt_identity())
    data = request.get_json()
    name = data.get("name")
    stage_id = parse_display_id(data.get("stage_id"), "STG")
    tag_id = parse_display_id(data.get("tag_id"), "TAG")
    step_id = parse_display_id(data.get("step_id"), "STP") 
    factor_id = data.get("factor_id")
    quantity = data.get("quantity")
    created_by = uid
    create_emission(
            name,
            parse_display_id(product_id),
            stage_id,
            factor_id,
            quantity,
            tag_id,
            step_id,
            created_by,
    )
    return json_response({"message": "Emission record created"}, 201)

@product_emission_bp.get("emissions/summary")
@jwt_required()
def summary(product_id):
    uid = int(get_jwt_identity())
    summary = get_emission_summary(parse_display_id(product_id, "PD"))
    return jsonify(summary), 200

@emission_bp.get("")
@jwt_required()
def get_all_by_org():
    uid = int(get_jwt_identity())
    org = get_user_organization(uid)
    org_id = org["id"]
    ps = get_emissions_by_org(org_id)
    return jsonify(emissions = ps), 200

@emission_bp.get("/<string:emission_id>")
@jwt_required()
def get_one(emission_id):
    emission = get_emission(parse_display_id(emission_id, "EMS"))
    if not emission:
        return jsonify({"error": "Emission record not found"}), 404
    return json_response({
        "emission_id": emission["id"],
        "emission_name": emission["name"],
        "product_id": emission["product_id"],
        "stage_id": emission["stage_id"],
        "tag_id": emission["tag_id"],
        "step_id": emission["step_id"], 
        "factor_id": emission["factor_id"],
        "quantity": emission["quantity"],
        "emission_amount": emission["emission_amount"],
        "created_at": emission["created_at"].isoformat(),
        "created_by": emission["created_by"],   
        "transport_origin": emission["transport_origin"],
        "transport_method": emission["transport_method"],
        "distance_per_trip": emission["distance_per_trip"],
        "transport_unit": emission["transport_unit"],
        "usage_ratio": emission["usage_ratio"],
        "allocation_basis": emission["allocation_basis"],
        "fuel_input_per_unit": emission["fuel_input_per_unit"],
        "fuel_input_unit": emission["fuel_input_unit"],
        "land_transport_tkm": emission["land_transport_tkm"],
        "unit_target_amount": emission["unit_target_amount"],
    }, 200)
    
@emission_bp.put("/<string:emission_id>")
@jwt_required()
def update(emission_id):
    data = request.get_json()
    quantity = data.get("new_amount")
    update_emission_quantity(parse_display_id(emission_id, "EMS"), quantity)
    return json_response({"message": "Emission record updated"}, 200)

@emission_bp.delete("/<string:emission_id>")
@jwt_required()
def delete(emission_id):
    delete_emission(parse_display_id(emission_id, "EMS"))
    return json_response({"message": "Emission record deleted"}, 200)

