# backend/routes/auth.py
from flask import Blueprint, request, jsonify
from flask_jwt_extended import (
    jwt_required, get_jwt_identity, get_jwt, create_access_token
)
# from werkzeug.security import generate_password_hash, check_password_hash
from db_connection import get_db
from models.user_model import (
    create_user, get_user_by_account, verify_password, 
    generate_tokens, get_user_by_id
)


auth_bp = Blueprint('auth', __name__, url_prefix='/auth') # all routes start with /auth

# -------- REGISTER --------
@auth_bp.post('/register')
def register():
    data = request.get_json(force=True)
    account = (data.get('account') or '').strip().lower()
    password = data.get('password')
    user_name = data.get('user_name')
    user_type = data.get('user_type', 'customer')  # optional

    if not account or not password or not user_name:
        return jsonify(error="account, password, and user_name are required"), 400

    existing_user = get_user_by_account(account)
    if existing_user:
        return jsonify(error="account already registered"), 409

    # create_user should hash the password internally or return hash to store
    user_id = create_user(account, password, user_name, user_type=user_type)

    # generate_tokens MUST set identity=user_id and put account in additional_claims
    tokens = generate_tokens(user_id, account, user_type=user_type)

    return jsonify(
        message="User registered successfully",
        access_token=tokens['access_token'],
        refresh_token=tokens['refresh_token']
    ), 201

# -------- LOGIN --------
@auth_bp.post('/login')
def login():
    data = request.get_json(force=True)
    account = (data.get('account') or '').strip().lower()
    password = data.get('password')

    if not account or not password:
        return jsonify(error="account and password required"), 400

    user = get_user_by_account(account)
    if not user:
        return jsonify(error="invalid credentials"), 401

    # Expect user to include 'password_hash'
    if not verify_password(user['password_hash'], password):
        return jsonify(error="invalid credentials"), 401

    tokens = generate_tokens(user['id'], account, user_type=user.get('user_type', 'customer'))
    return jsonify(
        message="Login successful",
        access_token=tokens['access_token'],
        refresh_token=tokens['refresh_token']
    ), 200

# -------- REFRESH (new access token) --------
@auth_bp.post('/refresh')
@jwt_required(refresh=True)
def refresh():
    # identity should be the numeric user_id
    user_id = get_jwt_identity()
    claims = get_jwt()
    account = claims.get('account')
    user_type = claims.get('user_type', 'customer')

    # issue a new short-lived access token
    new_access = create_access_token(
        identity=user_id,
        additional_claims={'account': account, 'user_type': user_type}
    )
    return jsonify(access_token=new_access), 200

# -------- ME: needs token from login (see the current logged in user) --------
@auth_bp.get('/me')
@jwt_required()
def me():
    user_id = int(get_jwt_identity())
    user = get_user_by_id(user_id)
    if not user:
        return jsonify(error="user not found"), 404
    user.pop('password_hash', None)
    return jsonify(user), 200

