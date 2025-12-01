import os

from config import Config
from dotenv import load_dotenv
from flask import Flask, jsonify, send_from_directory
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from routes.auth import auth_bp
from routes.onchain import onchain_bp
from routes.product_types import product_types_bp
from routes.products import product_bp
from routes.factor import factor_bp
from routes.emissions import emission_bp

load_dotenv()
jwt = JWTManager()


def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)  # Load configuration
    app.config["JSON_SORT_KEYS"] = False  # still ok for older Flask
    # For Flask 3 / new JSON provider:
    app.json.sort_keys = False

    jwt.init_app(app)  

    # register blueprints
    app.register_blueprint(onchain_bp)
    app.register_blueprint(auth_bp)
    app.register_blueprint(product_types_bp)
    app.register_blueprint(product_bp)
    app.register_blueprint(factor_bp)
    app.register_blueprint(emission_bp) 
    print("JSON_SORT_KEYS =", app.config.get("JSON_SORT_KEYS"))
    print("app.json.sort_keys =", app.json.sort_keys)
       
    # --------- Swagger ---------
    @app.route("/openapi.yaml")  # Serve raw OpenAPI file
    def openapi_yaml():
        return send_from_directory(
            os.path.dirname(__file__), "openapi.yaml", mimetype="text/yaml"
        )

    SWAGGER_HTML = """
    <!doctype html><html><head>
        <meta charset="utf-8"/>
        <title>Swagger UI</title>
        <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist/swagger-ui.css">
        </head><body>
        <div id="swagger"></div>
        <script src="https://unpkg.com/swagger-ui-dist/swagger-ui-bundle.js"></script>
        <script>
        window.ui = SwaggerUIBundle({ url: '/openapi.yaml', dom_id: '#swagger' });
        </script>
    </body></html>
    """

    # Run Swagger UI at root
    @app.route("/")
    def docs():
        
        return SWAGGER_HTML

    @app.route("/health")  # Health check route
    def health():
        return jsonify(ok=True), 200
    
    # List existing routes
    @app.route("/_routes")
    def list_routes():
        routes = []
        for rule in app.url_map.iter_rules():
            routes.append({
                "endpoint": rule.endpoint,
                "methods": list(rule.methods),
                "rule": str(rule)
            })
        
        return jsonify(routes)
    
    return app


app = create_app()
CORS(app, resources={r"/*": {"origins": "*"}})

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)
