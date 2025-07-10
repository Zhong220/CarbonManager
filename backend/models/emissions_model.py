from backend.database import get_db
from backend.models.factor_model import increment_usage_count, get_factor

EMISSION_COLLECTION = 'emissions'

def create_emission(product_id, stage_id, factor_id, quantity, created_by, 
                   transport_origin=None, transport_method=None, transport_unit=None,
                   distance_per_trip=None, usage_ratio=None, allocation_basis=None,
                   fuel_input_per_unit=None, fuel_input_unit=None, land_transport_tkm=None):
    # Get factor to calculate emission amount
    factor = get_factor(factor_id)
    emission_amount = quantity * factor['value_per_unit'] if factor else 0

    with get_db() as conn:
        cursor = conn.cursor(dictionary=True)
        sql = """
            INSERT INTO emissions (
                product_id, stage_id, factor_id, quantity, created_by,
                emission_amount, transport_origin, transport_method, transport_unit,
                distance_per_trip, usage_ratio, allocation_basis,
                fuel_input_per_unit, fuel_input_unit, land_transport_tkm
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
            )
        """
        values = (
            product_id, stage_id, factor_id, quantity, created_by,
            emission_amount, transport_origin, transport_method, transport_unit,
            distance_per_trip, usage_ratio, allocation_basis,
            fuel_input_per_unit, fuel_input_unit, land_transport_tkm
        )
        cursor.execute(sql, values)
        conn.commit()
        
        # Increment the usage count of the factor
        increment_usage_count(factor_id)
        return cursor.lastrowid

def get_emission(emission_id):
    with get_db() as conn:
        cursor = conn.cursor(dictionary=True)
        sql = "SELECT * FROM emissions WHERE id = %s"
        cursor.execute(sql, (emission_id,))
        result = cursor.fetchone()
        if result:
            result['id'] = result.pop('id')
            return result
        return None

def get_emissions_by_product(product_id):
    with get_db() as conn:
        cursor = conn.cursor(dictionary=True)
        sql = """
            SELECT e.*, f.name as factor_name, f.unit as factor_unit, s.name as stage_name
            FROM emissions e
            JOIN factors f ON e.factor_id = f.id
            JOIN emission_stages s ON e.stage_id = s.id
            WHERE e.product_id = %s
        """
        cursor.execute(sql, (product_id,))
        return cursor.fetchall()

def get_emissions_by_stage(stage_id):
    with get_db() as conn:
        cursor = conn.cursor(dictionary=True)
        sql = """
            SELECT e.*, f.name as factor_name, f.unit as factor_unit
            FROM emissions e
            JOIN factors f ON e.factor_id = f.id
            WHERE e.stage_id = %s
        """
        cursor.execute(sql, (stage_id,))
        return cursor.fetchall()

def get_emissions_by_product_and_stage(product_id, stage_id):
    with get_db() as conn:
        cursor = conn.cursor(dictionary=True)
        sql = """
            SELECT e.*, f.name as factor_name, f.unit as factor_unit
            FROM emissions e
            JOIN factors f ON e.factor_id = f.id
            WHERE e.product_id = %s AND e.stage_id = %s
        """
        cursor.execute(sql, (product_id, stage_id))
        return cursor.fetchall()

def update_emission(emission_id, data):
    # If quantity or factor_id is updated, recalculate emission_amount
    if 'quantity' in data or 'factor_id' in data:
        with get_db() as conn:
            cursor = conn.cursor(dictionary=True)
            # Get current emission data
            cursor.execute("SELECT * FROM emissions WHERE id = %s", (emission_id,))
            current = cursor.fetchone()
            
            quantity = data.get('quantity', current['quantity'])
            factor_id = data.get('factor_id', current['factor_id'])
            
            # Get factor and calculate new emission amount
            factor = get_factor(factor_id)
            data['emission_amount'] = quantity * factor['value_per_unit']

    # Update the emission
    with get_db() as conn:
        cursor = conn.cursor()
        # Build dynamic UPDATE query based on provided data
        fields = []
        values = []
        for key, value in data.items():
            fields.append(f"{key} = %s")
            values.append(value)
        values.append(emission_id)  # for WHERE clause
        
        sql = f"UPDATE emissions SET {', '.join(fields)} WHERE id = %s"
        cursor.execute(sql, values)
        conn.commit()
        return True

def delete_emission(emission_id):
    with get_db() as conn:
        cursor = conn.cursor()
        sql = "DELETE FROM emissions WHERE id = %s"
        cursor.execute(sql, (emission_id,))
        conn.commit()
        return True

def calculate_total_emissions_by_product(product_id):
    emissions = get_emissions_by_product(product_id)
    return sum(emission['emission_amount'] for emission in emissions)

def calculate_emissions_by_stage(product_id):
    emissions = get_emissions_by_product(product_id)
    stage_totals = {}
    for emission in emissions:
        stage_id = emission['stage_id']
        if stage_id not in stage_totals:
            stage_totals[stage_id] = 0
        stage_totals[stage_id] += emission['emission_amount']
    return stage_totals
