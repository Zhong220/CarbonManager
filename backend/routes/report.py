# backend/routes/report.py
from flask import current_app, Blueprint, Flask, send_file, render_template, abort
from pathlib import Path
import tempfile

from flask_jwt_extended import jwt_required

from routes.helpers import parse_display_id
from routes.generate_report import generate_report

report_bp = Blueprint("report", __name__, url_prefix="/report")


@report_bp.get("/<string:product_id>")
# @jwt_required() # Disable or testing
def download_report(product_id):
    
    template_path = current_app.config["REPORT_TEMPLATE"]

    tmp = tempfile.NamedTemporaryFile(suffix=".xlsx", delete=False)
    tmp_path = Path(tmp.name)
    tmp.close()
    product_id_int = parse_display_id(product_id, "PRD")
    generate_report(product_id_int, str(template_path), str(tmp_path))

    return send_file(
        tmp_path,
        as_attachment=True,
        download_name=f"{product_id}.xlsx",
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )

