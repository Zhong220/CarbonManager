from flask import Flask, jsonify
from flask_jwt_extended import JWTManager
from config import Config
import os
from db_connection import get_db
from dotenv import load_dotenv  

# Load environment variables
load_dotenv()

def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)    # Load configuration
    jwt = JWTManager(app)    
    
    # Health check route
    @app.route("/health")
    def health():
        return jsonify(ok=True), 200
    
    # Debug DB ping
    @app.route("/debug/db-ping")
    def db_ping():
        with get_db() as conn:
            cur = conn.cursor()
            cur.execute("SHOW TABLES;")
            tables = [row[0] for row in cur.fetchall()]
        return jsonify({"tables": tables})

    return app

    return app

app = create_app()

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000) # Listening on port 5000 inside the container

