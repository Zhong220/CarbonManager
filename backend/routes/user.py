from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from models.user_model import (
    create_user, get_user_by_account, verify_password, 
    generate_tokens, get_user_by_id
)

user_bp = Blueprint('user', __name__)

@user_bp.route('/register', methods=['POST'])
def register():
    data = request.json
    account = data.get('account')
    password = data.get('password')
    user_name = data.get('user_name')

    if not account or not password or not user_name:
        return jsonify({"error": "Account, password, and user name are required"}), 400

    existing_user = get_user_by_account(account)
    if existing_user:
        return jsonify({"error": "User already exists"}), 409

    user_id = create_user(account, password, user_name)
    tokens = generate_tokens(user_id, account)
    
    return jsonify({
        "message": "User registered successfully",
        "access_token": tokens['access_token'],
        "refresh_token": tokens['refresh_token']
    }), 201

@user_bp.route('/login', methods=['POST'])
def login():
    data = request.json
    if data is None:
        return jsonify({"error": "Invalid JSON or missing Content-Type header"}), 400
    
    account = data.get('account')
    password = data.get('password')

    if not account or not password:
        return jsonify({"error": "Account and password required"}), 400

    user = get_user_by_account(account)
    if user and verify_password(user['password'], password):
        tokens = generate_tokens(user['id'], account)
        return jsonify({
            "message": "Login successful",
            "access_token": tokens['access_token'],
            "refresh_token": tokens['refresh_token']
        }), 200
    else:
        return jsonify({"error": "Invalid credentials"}), 401

@user_bp.route('/me', methods=['GET'])
@jwt_required()
def get_current_user():
    current_user_id = get_jwt_identity()
    user = get_user_by_id(current_user_id)
    
    if not user:
        return jsonify({"error": "User not found"}), 404
    
    # Remove sensitive information
    user.pop('password', None)
    return jsonify(user), 200

# Test route to verify JWT is working
@user_bp.route('/test', methods=['GET'])
@jwt_required()
def test_auth():
    current_user_id = get_jwt_identity()
    claims = get_jwt()
    return jsonify({
        "message": "Authentication successful",
        "user_id": current_user_id,
        "account": claims.get('account')
    }), 200
