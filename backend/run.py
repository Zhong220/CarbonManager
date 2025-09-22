from flask import Flask, jsonify, send_from_directory
from flask_jwt_extended import JWTManager
from config import Config
import os
from db_connection import get_db
from dotenv import load_dotenv  

from routes.onchain import onchain_bp

# Load environment variables
load_dotenv()

def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)    # Load configuration
    # jwt = JWTManager(app)    
    

    # register blueprints
    app.register_blueprint(onchain_bp)
    

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
    @app.route("/docs")   # Serve Swagger UI
    def docs():
        return SWAGGER_HTML

    # --------- Utility routes --------- 
    @app.route("/health")       # Health check route
    def health():
        return jsonify(ok=True), 200
    
    @app.route("/debug/db-ping")    # Debug DB ping
    def db_ping():
        with get_db() as conn:
            cur = conn.cursor()
            try:
                cur.execute("SHOW TABLES;")
                tables = [row[0] for row in cur.fetchall()]
            finally:
                cur.close()
        return jsonify({"tables": tables})


    return app

app = create_app()

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000) # Listening on port 5000 inside the container

