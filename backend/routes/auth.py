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
from models.organizations_model import (
    create_organization,
    assign_user_to_org,
    get_organization_by_id,
    get_organization_by_name
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

# ------- PUT: Update user info (user type and org only for now) -------
@auth_bp.put('/me')
@jwt_required()
def update_me():    
    user_id = int(get_jwt_identity())
    user = get_user_by_id(user_id)
    if not user:
        return jsonify(error="user not found"), 404
    data = request.get_json(force=True)
    new_user_type = (data.get('user_type') or '').strip().lower()
    org_name = data.get('organization_name')
    if new_user_type not in ('customer', 'shop'):
        return jsonify(error="invalid user_type"), 400
    if org_name is not None and new_user_type == 'shop':
        org = get_organization_by_name(org_name)
        if not org:
            return jsonify(error="organization not found"), 404
        assign_user_to_org(user_id, org['id'])
    return jsonify(message="user updated"), 200
    
# -------- Register organization --------
@auth_bp.post('/organization')
def register_organization():
    data = request.get_json(force=True)
    name = (data.get("name") or "").strip()
    slug = (data.get("slug") or "").strip() or None
    if not name:
        return jsonify(error="name is required"), 400
    if len(name) > 100:
        return jsonify(error="name must be at most 100 characters"), 400
    if slug and len(slug) > 50:
        return jsonify(error="slug must be at most 50 characters"), 400

    try:
        org_id = create_organization(name=name, slug=slug)
        org = get_organization_by_id(org_id)
        return jsonify(org), 201
    except Exception as e:
        return jsonify(error="Error creating organization", detail=str(e)), 500
