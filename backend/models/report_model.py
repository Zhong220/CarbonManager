from firebase_admin import firestore
from firestore import db
from models.emissions_model import (
    calculate_emissions_by_stage,
    calculate_total_emissions_by_product,
)

REPORT_COLLECTION = "reports"


def create_report(name, cf_id):
    data = {
        "name": name,
        "cf_id": cf_id,  # carbon footprint product id
        "created_time": firestore.SERVER_TIMESTAMP,
        "total_emissions": 0,
        "stage_emissions": {},
        "status": "draft",  # draft, published
    }
    doc_ref = db.collection(REPORT_COLLECTION).add(data)
    return doc_ref[1].id


def get_report(report_id):
    doc_ref = db.collection(REPORT_COLLECTION).document(report_id)
    doc = doc_ref.get()
    if doc.exists:
        report = doc.to_dict()
        report["id"] = doc.id
        return report
    return None


def get_reports_by_product(cf_id):
    docs = db.collection(REPORT_COLLECTION).where("cf_id", "==", cf_id).stream()
    reports = []
    for doc in docs:
        report = doc.to_dict()
        report["id"] = doc.id
        reports.append(report)
    return reports


def update_report(report_id, data):
    doc_ref = db.collection(REPORT_COLLECTION).document(report_id)
    doc_ref.update(data)
    return True


def delete_report(report_id):
    doc_ref = db.collection(REPORT_COLLECTION).document(report_id)
    doc_ref.delete()
    return True


def calculate_report(report_id):
    report = get_report(report_id)
    if not report:
        return None

    # Calculate total emissions
    total_emissions = calculate_total_emissions_by_product(report["cf_id"])

    # Calculate emissions by stage
    stage_emissions = calculate_emissions_by_stage(report["cf_id"])

    # Update report with calculations
    update_report(
        report_id,
        {
            "total_emissions": total_emissions,
            "stage_emissions": stage_emissions,
            "last_calculated_at": firestore.SERVER_TIMESTAMP,
        },
    )

    return {"total_emissions": total_emissions, "stage_emissions": stage_emissions}


def publish_report(report_id):
    # Recalculate before publishing
    calculate_report(report_id)

    return update_report(
        report_id, {"status": "published", "published_at": firestore.SERVER_TIMESTAMP}
    )
