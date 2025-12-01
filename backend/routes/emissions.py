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



product_emission_bp = Blueprint("emissions", __name__, url_prefix="/emissions")
emission_bp = Blueprint("emissions", __name__, url_prefix="/emissions")

# Product Emissions routes 
# -------- GET: List emissions from one product --------
@product_emission_bp.get("emissions")
@jwt_required()
def get_all(product_id):    
    ps = get_emissions_by_product(product_id)
    return jsonify(emissions = ps), 200

# -------- POST: Create emission record for a product --------
@product_emission_bp.post("emissions")
@jwt_required()
def create(product_id):
    uid = int(get_jwt_identity())
    data = request.get_json()
    name = data.get("name")
    stage_id = data.get("stage_id")
    factor_id = data.get("factor_id")
    tag_id = data.get("tag_id")
    quantity = data.get("quantity")
    step_id = data.get("step_id") 
    created_by = uid
    create_emission(
            name,
            product_id,
            stage_id,
            factor_id,
            quantity,
            tag_id,
            step_id,
            created_by,
    )
    return jsonify({"message": "Emission record created"}), 201


# -------- GET: Get emission summary for a product --------
@product_emission_bp.get("emissions/summary")
@jwt_required()
def summary(product_id):
    uid = int(get_jwt_identity())
    org = get_user_organization(uid)
    org_id = org["id"]
    summary = get_emission_summary(product_id)
    return jsonify(summary), 200

# -------- By Id: List emissions from one organization --------
@emission_bp.get("")
@jwt_required()
def get_all_by_org():
    uid = int(get_jwt_identity())
    org = get_user_organization(uid)
    org_id = org["id"]
    ps = get_emissions_by_org(org_id)
    return jsonify(emissions = ps), 200

# -------- By Id: Fetch single emission record --------
@emission_bp.get("/<int:emission_id>")
@jwt_required()
def get_one(emission_id):
    emission = get_emission(emission_id)
    if not emission:
        return jsonify({"error": "Emission record not found"}), 404
    return jsonify(emission), 200

# -------- By Id: Update single emission record --------
@emission_bp.put("/<int:emission_id>")
@jwt_required()
def update(emission_id):
    data = request.get_json()
    quantity = data.get("new_amount")
    update_emission_quantity(emission_id, quantity)
    return jsonify({"message": "Emission record updated"}), 200

# -------- By Id: Delete single emission record --------
@emission_bp.delete("/<int:emission_id>")
@jwt_required()
def delete(emission_id):
    delete_emission(emission_id)
    return jsonify({"message": "Emission record deleted"}), 200

