from flask import Flask, jsonify, send_from_directory
from flask_jwt_extended import JWTManager
from config import Config
import webbrowser

import os
from db_connection import get_db
from dotenv import load_dotenv  

from routes.onchain import onchain_bp
from routes.auth import auth_bp
from routes.product_types import product_types_bp

# Load environment variables
load_dotenv()

jwt = JWTManager()    

def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)    # Load configuration
    
    jwt.init_app(app)   # Initialize JWT

    # register blueprints
    app.register_blueprint(onchain_bp)
    app.register_blueprint(auth_bp)
    app.register_blueprint(product_types_bp)
    
    # --------- Swagger ---------
    @app.route("/openapi.yaml")     # Serve raw OpenAPI file
    def openapi_yaml():
        return send_from_directory(os.path.dirname(__file__), "openapi.yaml", mimetype="text/yaml")

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

    @app.route("/health")       # Health check route
    def health():
        return jsonify(ok=True), 200
    

    return app

app = create_app()

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000) # Listening on port 5000 inside the container
    # Auto open swagger UI in browser
    # webbrowser.open('http://localhost:5000/docs')
    