# backend/routes/auth.py
from flask import Blueprint, jsonify, request
from flask_jwt_extended import (
    create_access_token,
    get_jwt,
    get_jwt_identity,
    jwt_required,
)
from models.organizations_model import (
    assign_user_to_org,
    create_organization,
    get_organization_by_name,
)

# from werkzeug.security import generate_password_hash, check_password_hash
from models.user_model import (
    create_user,
    generate_tokens,
    get_user_by_account,
    get_user_by_id,
    verify_password,
    delete_user,
)

auth_bp = Blueprint("auth", __name__, url_prefix="/auth")  # all routes start with /auth


# -------- REGISTER --------
@auth_bp.post("/register")
def register():
    data = request.get_json(force=True)
    account = (data.get("account") or "").strip().lower()
    password = data.get("password")
    user_name = data.get("user_name")
    user_type = (data.get("role") or "customer").strip().lower()
    org_name = (data.get("organization_name") or "").strip() if user_type == "shop" else None

    if not account or not password or not user_name:
        return jsonify(error="account, password, and user_name are required"), 400
    if user_type not in ("customer", "shop"):
        return jsonify(error="invalid user_type"), 400
    if user_type == "shop" and not org_name:
        return jsonify(error="org_name required for shop registration"), 400
    if get_user_by_account(account):
        return jsonify(error="account already registered"), 409

    # Shop Owners
    org_id = None
    if user_type == "shop":
        org = create_organization(org_name)
        org_id = org["id"]

    # create_user
    user_id = create_user(
        account, password, user_name, user_type=user_type, organization_id=org_id
    )

    # tokens embed user_type + organization_id
    tokens = generate_tokens(
        user_id, account, user_type=user_type, organization_id=org_id
    )

    return (
        jsonify(
            status_message="201: User registered successfully",
            access_token=tokens["access_token"],
            refresh_token=tokens["refresh_token"],
            account=account,
            password=password,
            user_name=user_name,
            role=user_type,
            current_organization_id=org_id
        ),
        201,
    )


# -------- LOGIN --------
@auth_bp.post("/login")
def login():
    data = request.get_json(force=True)
    account = (data.get("account") or "").strip().lower()
    password = data.get("password")
    if not account or not password:
        return jsonify(error="account and password required"), 400

    user = get_user_by_account(account)
    if not user:
        return jsonify(error="invalid credentials"), 401

    # Expect user to include 'password_hash'
    if not verify_password(user["password_hash"], password):
        return jsonify(error="invalid credentials"), 401

    tokens = generate_tokens(
        user["id"],
        account,
        user_type=user["user_type"],
        organization_id=user["organization_id"],
    )
    return (
        jsonify(
            status_message="200: Login successful",
            account=account,
            access_token=tokens["access_token"],
            refresh_token=tokens["refresh_token"],
            role=user["user_type"],
            current_organization_id=user["organization_id"],
        ),
        200,
    )


# -------- REFRESH: new access token --------
@auth_bp.post("/refresh")
@jwt_required(refresh=True)
def refresh():
    # identity should be the numeric user_id
    user_id = get_jwt_identity()
    claims = get_jwt()
    account = claims.get("account")
    user_type = claims.get("user_type", "customer")

    # issue a new short-lived access token
    new_access = create_access_token(
        identity=user_id, additional_claims={"account": account, "user_type": user_type}
    )
    return jsonify(access_token=new_access), 200


# -------- ME: see the current logged in user --------
@auth_bp.get("/me")
@jwt_required()
def me():
    user_id = int(get_jwt_identity())
    user = get_user_by_id(user_id)
    if not user:
        return jsonify(error="user not found"), 404
    user.pop("password_hash", None)
    return jsonify(user), 200


# ------- ME: Update user info -------
@auth_bp.put("/me")
@jwt_required()
def update_me():
    user_id = int(get_jwt_identity())
    user = get_user_by_id(user_id)
    if not user:
        return jsonify(error="user not found"), 404
    data = request.get_json(force=True)
    new_user_type = (data.get("user_type") or "").strip().lower()
    org_name = data.get("organization_name")
    if new_user_type not in ("customer", "shop"):
        return jsonify(error="invalid user_type"), 400
    if org_name is not None and new_user_type == "shop":
        org = get_organization_by_name(org_name)
        if not org:
            return jsonify(error="organization not found"), 404
        assign_user_to_org(user_id, org["id"])
    return jsonify(message="user updated"), 200



#-------- DELETE ME --------
@auth_bp.delete("/me")
@jwt_required()
def delete_me():
    user_id = int(get_jwt_identity())
    user = get_user_by_id(user_id)
    if not user:
        return jsonify(error="user not found"), 404
    delete_user(user_id)
    return jsonify(message="user deleted"), 200

