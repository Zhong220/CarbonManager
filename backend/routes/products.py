# backend/routes/products.py
from flask import Blueprint, jsonify, request
from flask_jwt_extended import (
    create_access_token,
    get_jwt,
    get_jwt_identity,
    jwt_required,
)
from models.user_model import get_user_organization
from models.products_model import(
                        list_products, 
                        fetch_product, 
                        create_product, 
                        update_product, 
                        delete_product
                        )


products_bp = Blueprint('products', __name__)   

# -------- LIST PRODUCTS --------
@products_bp.route('/products', methods=['GET'])
@jwt_required()
def get_all(type_id):
    uid = int(get_jwt_identity())
    org = get_user_organization(uid)
    org_id = org["id"]
    ps = list_products(org_id, type_id)
    return jsonify(products = ps), 200


@products_bp.route('/products', methods=['POST'])
@jwt_required()
def create(type_id):
    uid = int(get_jwt_identity())
    org = get_user_organization(uid)
    org_id = org["id"]
    data = request.get_json()
    name = data.get("name")
    serial_number = data.get("serial_number")
    code = data.get("code")
    create_product(org_id, type_id, name, serial_number, code)
    return jsonify({"message": "Product created"}), 201



@products_bp.route('/products/<int:product_id>', methods=['GET'])
@jwt_required()
def get(type_id, product_id):
    product = fetch_product(product_id)
    if not product:
        return jsonify({"error": "Product not found"}), 404
    return jsonify(product), 200


@products_bp.route('/products/<int:product_id>', methods=['PUT'])
@jwt_required()
def update(type_id, product_id):
    data = request.get_json()
    organization_id = data.get("organization_id")
    type_id = data.get("type_id")
    name = data.get("name")
    serial_number = data.get("serial_number")
    code = data.get("code")
    update_product(product_id, organization_id, type_id, name, serial_number, code)
    return jsonify({"message": "Product updated"}), 200


@products_bp.route('/products/<int:product_id>', methods=['DELETE'])
@jwt_required()
def delete(type_id, product_id):
    delete_product(product_id)
    return jsonify({"message": "Product deleted"}), 200

