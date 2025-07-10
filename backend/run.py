from flask import Flask, jsonify
from flask_jwt_extended import JWTManager
from config import Config
from routes.user import user_bp
from scripts.init_db import run_sql_script
import os
from dotenv import load_dotenv  

# Load environment variables
load_dotenv()

def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)    # Load configuration
    jwt = JWTManager(app)    
    return app

app = create_app()

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5001) # Listening on port 5001 

