"""
SENTINEL API routes — dashboard and module read/write endpoints.
"""

from flask import Blueprint, jsonify, request
from mysql.connector import Error
from backend.db import get_db_connection, close_connection

api_bp = Blueprint('api', __name__, url_prefix='/api')


def fetch_all(query, params=None):
    """Run SELECT and return list of dicts."""
    conn = get_db_connection()
    if conn is None:
        return None, 'Database connection failed'
    cursor = None
    try:
        cursor = conn.cursor(dictionary=True)
        cursor.execute(query, params or ())
        rows = cursor.fetchall()
        return rows, None
    except Error as e:
        return None, str(e)
    finally:
        close_connection(conn, cursor)


def fetch_one(query, params=None):
    """Run SELECT and return one dict."""
    rows, err = fetch_all(query, params)
    if err:
        return None, err
    if not rows:
        return None, None
    return rows[0], None


def run_write(query, params=None):
    """Run INSERT/UPDATE/DELETE. Returns (last_id, error)."""
    conn = get_db_connection()
    if conn is None:
        return None, 'Database connection failed'
    cursor = None
    try:
        cursor = conn.cursor()
        cursor.execute(query, params or ())
        conn.commit()
        last_id = cursor.lastrowid
        return last_id, None
    except Error as e:
        if conn:
            conn.rollback()
        return None, str(e)
    finally:
        close_connection(conn, cursor)


def call_procedure(proc_name, args=None):
    """Call a stored procedure; return all result sets as lists."""
    conn = get_db_connection()
    if conn is None:
        return None, 'Database connection failed'
    cursor = None
    try:
        cursor = conn.cursor(dictionary=True)
        cursor.callproc(proc_name, args or [])
        results = []
        for result in cursor.stored_results():
            results.append(result.fetchall())
        conn.commit()
        return results, None
    except Error as e:
        if conn:
            conn.rollback()
        return None, str(e)
    finally:
        close_connection(conn, cursor)


# =====================================================================
# DASHBOARD
# =====================================================================

@api_bp.route('/dashboard/stats', methods=['GET'])
def dashboard_stats():
    row, err = fetch_one('SELECT * FROM view_dashboard_stats')
    if err:
        return jsonify({'status': 'error', 'message': err}), 500

    severity, _ = fetch_all('SELECT * FROM view_severity_breakdown')
    fleet, _ = fetch_all('SELECT * FROM view_ambulance_status')
    blood, _ = fetch_all('SELECT blood_group, units_available FROM blood_stock ORDER BY blood_group')
    beds, _ = fetch_one('''
        SELECT
            IFNULL(SUM(available_beds), 0) AS available,
            IFNULL(SUM(total_beds - available_beds), 0) AS occupied,
            IFNULL(SUM(total_beds), 0) AS total
        FROM hospitals
    ''')

    sev_map = {'CRITICAL': 0, 'HIGH': 0, 'MODERATE': 0, 'LOW': 0}
    if severity:
        for s in severity:
            sev_map[s['severity']] = s['count']

    fleet_map = {'AVAILABLE': 0, 'DISPATCHED': 0, 'MAINTENANCE': 0}
    if fleet:
        for f in fleet:
            fleet_map[f['status']] = f['count']

    return jsonify({
        'status': 'success',
        'stats': row or {},
        'severity': sev_map,
        'fleet': fleet_map,
        'beds': beds or {'available': 0, 'occupied': 0, 'total': 0},
        'blood': blood or []
    })


@api_bp.route('/dashboard/recent-incidents', methods=['GET'])
def recent_incidents():
    rows, err = fetch_all('''
        SELECT incident_id, title, incident_type, severity, status,
               location_desc, reported_time
        FROM incidents
        ORDER BY reported_time DESC
        LIMIT 8
    ''')
    if err:
        return jsonify({'status': 'error', 'message': err}), 500
    return jsonify({'status': 'success', 'data': rows or []})


@api_bp.route('/dashboard/recent-responses', methods=['GET'])
def recent_responses():
    rows, err = fetch_all('SELECT * FROM view_recent_responses LIMIT 8')
    if err:
        return jsonify({'status': 'error', 'message': err}), 500
    return jsonify({'status': 'success', 'data': rows or []})


@api_bp.route('/dashboard/alerts', methods=['GET'])
def dashboard_alerts():
    rows, err = fetch_all('''
        SELECT alert_id, incident_id, alert_level, message, alert_time, is_acknowledged
        FROM alerts
        ORDER BY alert_time DESC
        LIMIT 10
    ''')
    if err:
        return jsonify({'status': 'error', 'message': err}), 500
    return jsonify({'status': 'success', 'data': rows or []})


@api_bp.route('/dashboard/map-incidents', methods=['GET'])
def map_incidents():
    rows, err = fetch_all('''
        SELECT incident_id, title, incident_type, severity, status,
               location_desc,
               latitude,
               longitude,
               (SELECT COUNT(*) FROM dispatch_ambulances da
                WHERE da.incident_id = i.incident_id
                  AND da.status IN ('EN_ROUTE','ON_SCENE','DISPATCHED')) AS units_on_scene
        FROM incidents i
        WHERE status IN ('ACTIVE', 'CONTAINED')
          AND latitude IS NOT NULL
          AND longitude IS NOT NULL
          AND latitude != 0
          AND longitude != 0
    ''')
    if err:
        return jsonify({'status': 'error', 'message': err}), 500
    return jsonify({'status': 'success', 'data': rows or []})

# =====================================================================
# INCIDENTS
# =====================================================================

@api_bp.route('/incidents', methods=['GET'])
def list_incidents():
    status = request.args.get('status')
    severity = request.args.get('severity')
    q = '''
        SELECT i.*,
               (SELECT COUNT(*) FROM victims v WHERE v.incident_id = i.incident_id) AS victim_count
        FROM incidents i
        WHERE 1=1
    '''
    params = []
    if status:
        q += ' AND i.status = %s'
        params.append(status)
    if severity:
        q += ' AND i.severity = %s'
        params.append(severity)
    q += ' ORDER BY i.reported_time DESC'

    rows, err = fetch_all(q, params)
    if err:
        return jsonify({'status': 'error', 'message': err}), 500
    return jsonify({'status': 'success', 'data': rows or []})


@api_bp.route('/incidents/<int:incident_id>', methods=['GET'])
def get_incident(incident_id):
    results, err = call_procedure('sp_incident_report', [incident_id])
    if err:
        return jsonify({'status': 'error', 'message': err}), 500
    return jsonify({
        'status': 'success',
        'incident': results[0][0] if results and results[0] else None,
        'victims': results[1] if len(results) > 1 else [],
        'ambulances': results[2] if len(results) > 2 else [],
        'teams': results[3] if len(results) > 3 else [],
        'resources': results[4] if len(results) > 4 else []
    })


@api_bp.route('/incidents', methods=['POST'])
def create_incident():
    data = request.get_json() or {}
    required = ['title', 'incident_type', 'severity', 'location_desc']
    for f in required:
        if not data.get(f):
            return jsonify({'status': 'error', 'message': f'Missing field: {f}'}), 400

    # --- normalize enums to match MySQL ENUM values ---
    type_map = {
        'FIRE': 'FIRE',
        'WILDFIRE': 'WILDFIRE',
        'FLOOD': 'FLOOD',
        'EARTHQUAKE': 'EARTHQUAKE',
        'ACCIDENT': 'ACCIDENT',
        'MULTI-VEHICLE ACCIDENT': 'ACCIDENT',
        'MULTI_VEHICLE_ACCIDENT': 'ACCIDENT',
        'HAZMAT': 'HAZMAT',
        'BUILDING COLLAPSE': 'BUILDING_COLLAPSE',
        'BUILDING_COLLAPSE': 'BUILDING_COLLAPSE',
        'INDUSTRIAL ACCIDENT': 'ACCIDENT',
        'OTHER': 'OTHER',
    }
    raw_type = str(data['incident_type']).strip().upper().replace('-', '_')
    # allow already-correct values; map friendly names
    incident_type = type_map.get(raw_type, type_map.get(raw_type.replace('_', ' '), raw_type))
    # final fallback if DB only has a smaller set
    allowed_types = {
        'WILDFIRE', 'FIRE', 'FLOOD', 'EARTHQUAKE', 'ACCIDENT',
        'HAZMAT', 'BUILDING_COLLAPSE', 'OTHER'
    }
    if incident_type not in allowed_types:
        # last-resort: keep short token so VARCHAR/ENUM won't choke
        incident_type = raw_type[:32]

    sev_map = {
        'CRITICAL': 'CRITICAL',
        'HIGH': 'HIGH',
        'MODERATE': 'MODERATE',
        'MEDIUM': 'MODERATE',
        'LOW': 'LOW',
    }
    severity = sev_map.get(str(data['severity']).strip().upper(), 'MODERATE')

    # coords
    lat = data.get('latitude')
    lng = data.get('longitude')
    try:
        lat = float(lat) if lat is not None and str(lat).strip() != '' else None
    except (ValueError, TypeError):
        lat = None
    try:
        lng = float(lng) if lng is not None and str(lng).strip() != '' else None
    except (ValueError, TypeError):
        lng = None

    title = str(data['title']).strip()[:200]
    location_desc = str(data['location_desc']).strip()[:255]

    # 1) try stored procedure
    results, err = call_procedure('sp_register_incident', [
        title, incident_type, severity, location_desc, lat, lng
    ])
    if not err and results and results[0]:
        return jsonify({'status': 'success', 'data': results[0][0]}), 201

    # 2) guaranteed direct insert + commit
    last_id, write_err = run_write('''
        INSERT INTO incidents
            (title, incident_type, severity, location_desc, latitude, longitude, status, reported_time)
        VALUES (%s, %s, %s, %s, %s, %s, 'ACTIVE', NOW())
    ''', (title, incident_type, severity, location_desc, lat, lng))

    if write_err:
        # if ENUM still rejects, return a clear message
        return jsonify({
            'status': 'error',
            'message': write_err,
            'hint': 'Check incidents.incident_type ENUM values in MySQL. Sent type=' + incident_type
        }), 500

    row, _ = fetch_one('SELECT * FROM incidents WHERE incident_id = %s', (last_id,))
    return jsonify({'status': 'success', 'data': row or {'incident_id': last_id}}), 201

@api_bp.route('/incidents/<int:incident_id>/status', methods=['PUT'])
def update_incident_status(incident_id):
    data = request.get_json() or {}
    new_status = data.get('status')
    if new_status not in ('ACTIVE', 'CONTAINED', 'RESOLVED'):
        return jsonify({'status': 'error', 'message': 'Invalid status'}), 400

    _, err = run_write(
        'UPDATE incidents SET status = %s WHERE incident_id = %s',
        (new_status, incident_id)
    )
    if err:
        return jsonify({'status': 'error', 'message': err}), 500
    return jsonify({'status': 'success', 'message': 'Status updated'})


# =====================================================================
# VICTIMS
# =====================================================================

@api_bp.route('/victims', methods=['GET'])
def list_victims():
    rows, err = fetch_all('''
        SELECT v.*, i.title AS incident_title, h.name AS hospital_name
        FROM victims v
        JOIN incidents i ON i.incident_id = v.incident_id
        LEFT JOIN hospitals h ON h.hospital_id = v.hospital_id
        ORDER BY v.victim_id DESC
    ''')
    if err:
        return jsonify({'status': 'error', 'message': err}), 500
    return jsonify({'status': 'success', 'data': rows or []})


@api_bp.route('/victims', methods=['POST'])
def create_victim():
    data = request.get_json() or {}
    if not data.get('incident_id') or not data.get('medical_condition'):
        return jsonify({'status': 'error', 'message': 'incident_id and medical_condition required'}), 400

    last_id, err = run_write('''
        INSERT INTO victims (incident_id, name, age, gender, medical_condition)
        VALUES (%s, %s, %s, %s, %s)
    ''', (
        data['incident_id'],
        data.get('name', 'UNKNOWN'),
        data.get('age'),
        data.get('gender', 'UNKNOWN'),
        data['medical_condition']
    ))
    if err:
        return jsonify({'status': 'error', 'message': err}), 500
    return jsonify({'status': 'success', 'victim_id': last_id}), 201


@api_bp.route('/victims/<int:victim_id>/admit', methods=['PUT'])
def admit_victim(victim_id):
    data = request.get_json() or {}
    hospital_id = data.get('hospital_id')
    if not hospital_id:
        return jsonify({'status': 'error', 'message': 'hospital_id required'}), 400

    # Try stored procedure first
    results, err = call_procedure('sp_admit_victim', [victim_id, hospital_id])
    if not err:
        msg = results[0][0].get('message') if results and results[0] else 'Done'
        if 'ERROR' not in str(msg).upper():
            return jsonify({'status': 'success', 'message': msg})

    # Guaranteed fallback (transactional bed update)
    conn = get_db_connection()
    if conn is None:
        return jsonify({'status': 'error', 'message': 'DB connection failed'}), 500
    cursor = None
    try:
        cursor = conn.cursor(dictionary=True)
        conn.start_transaction()

        cursor.execute('SELECT hospital_id FROM victims WHERE victim_id = %s FOR UPDATE', (victim_id,))
        vic = cursor.fetchone()
        if not vic:
            conn.rollback()
            return jsonify({'status': 'error', 'message': 'Victim not found'}), 404
        if vic.get('hospital_id'):
            conn.rollback()
            return jsonify({'status': 'error', 'message': 'Victim already admitted'}), 400

        cursor.execute('''
            SELECT hospital_id, total_beds, occupied_beds,
                   (total_beds - occupied_beds) AS available_beds
            FROM hospitals WHERE hospital_id = %s FOR UPDATE
        ''', (hospital_id,))
        hos = cursor.fetchone()
        if not hos:
            conn.rollback()
            return jsonify({'status': 'error', 'message': 'Hospital not found'}), 404

        available = hos.get('available_beds')
        if available is None:
            available = int(hos['total_beds']) - int(hos['occupied_beds'] or 0)
        if int(available) <= 0:
            conn.rollback()
            return jsonify({'status': 'error', 'message': 'No beds available at this hospital'}), 400

        cursor.execute(
            'UPDATE victims SET hospital_id = %s WHERE victim_id = %s',
            (hospital_id, victim_id)
        )
        cursor.execute(
            'UPDATE hospitals SET occupied_beds = occupied_beds + 1 WHERE hospital_id = %s',
            (hospital_id,)
        )
        conn.commit()
        return jsonify({
            'status': 'success',
            'message': f'Victim admitted. Beds updated at hospital {hospital_id}.'
        })
    except Error as e:
        conn.rollback()
        return jsonify({'status': 'error', 'message': str(e)}), 500
    finally:
        close_connection(conn, cursor)


# =====================================================================
# AMBULANCES
# =====================================================================

@api_bp.route('/ambulances', methods=['GET'])
def list_ambulances():
    rows, err = fetch_all('SELECT * FROM ambulances ORDER BY ambulance_id')
    if err:
        return jsonify({'status': 'error', 'message': err}), 500
    return jsonify({'status': 'success', 'data': rows or []})


@api_bp.route('/ambulances/dispatch', methods=['POST'])
def dispatch_ambulance():
    data = request.get_json() or {}
    if not data.get('incident_id') or not data.get('ambulance_id'):
        return jsonify({'status': 'error', 'message': 'incident_id and ambulance_id required'}), 400

    results, err = call_procedure('sp_dispatch_ambulance', [
        data['incident_id'], data['ambulance_id']
    ])
    if err:
        return jsonify({'status': 'error', 'message': err}), 500
    msg = results[0][0]['message'] if results and results[0] else 'Done'
    if 'ERROR' in str(msg) or 'not' in str(msg).lower():
        return jsonify({'status': 'error', 'message': msg}), 400
    return jsonify({'status': 'success', 'message': msg})


# =====================================================================
# RESCUE TEAMS
# =====================================================================

@api_bp.route('/teams', methods=['GET'])
def list_teams():
    rows, err = fetch_all('SELECT * FROM rescue_teams ORDER BY team_id')
    if err:
        return jsonify({'status': 'error', 'message': err}), 500
    return jsonify({'status': 'success', 'data': rows or []})


@api_bp.route('/teams/dispatch', methods=['POST'])
def dispatch_team():
    data = request.get_json() or {}
    incident_id = data.get('incident_id')
    team_id = data.get('team_id')
    if not incident_id or not team_id:
        return jsonify({'status': 'error', 'message': 'incident_id and team_id required'}), 400

    conn = get_db_connection()
    if conn is None:
        return jsonify({'status': 'error', 'message': 'DB connection failed'}), 500
    cursor = None
    try:
        cursor = conn.cursor(dictionary=True)
        conn.start_transaction()
        cursor.execute('SELECT status FROM rescue_teams WHERE team_id = %s FOR UPDATE', (team_id,))
        team = cursor.fetchone()
        if not team:
            conn.rollback()
            return jsonify({'status': 'error', 'message': 'Team not found'}), 404
        if team['status'] != 'AVAILABLE':
            conn.rollback()
            return jsonify({'status': 'error', 'message': 'Team not available'}), 400

        cursor.execute('''
            INSERT INTO dispatch_teams (incident_id, team_id, status)
            VALUES (%s, %s, 'DEPLOYED')
        ''', (incident_id, team_id))
        cursor.execute('UPDATE rescue_teams SET status = %s WHERE team_id = %s', ('DEPLOYED', team_id))
        conn.commit()
        return jsonify({'status': 'success', 'message': 'Team dispatched'})
    except Error as e:
        conn.rollback()
        return jsonify({'status': 'error', 'message': str(e)}), 500
    finally:
        close_connection(conn, cursor)


# =====================================================================
# HOSPITALS
# =====================================================================

@api_bp.route('/hospitals', methods=['GET'])
def list_hospitals():
    rows, err = fetch_all('SELECT * FROM hospitals ORDER BY hospital_id')
    if err:
        # fallback to view if base table query fails
        rows, err = fetch_all('SELECT * FROM view_hospital_capacity')
    if err:
        return jsonify({'status': 'error', 'message': err}), 500

    normalized = []
    for h in (rows or []):
        total = int(h.get('total_beds') or 0)
        # prefer explicit occupied; else derive from available
        if h.get('occupied_beds') is not None:
            occupied = int(h.get('occupied_beds') or 0)
        else:
            available = int(h.get('available_beds') or 0)
            occupied = max(total - available, 0)
        available = int(h.get('available_beds') if h.get('available_beds') is not None else max(total - occupied, 0))
        occ_rate = h.get('occupancy_rate')
        if occ_rate is None:
            occ_rate = round((occupied / total) * 100, 1) if total else 0
        normalized.append({
            'hospital_id': h.get('hospital_id'),
            'name': h.get('name'),
            'location': h.get('location'),
            'total_beds': total,
            'occupied_beds': occupied,
            'available_beds': available,
            'occupancy_rate': occ_rate
        })
    return jsonify({'status': 'success', 'data': normalized})

@api_bp.route('/doctors', methods=['GET'])
def list_doctors():
    rows, err = fetch_all('''
        SELECT d.*, h.name AS hospital_name
        FROM doctors d
        JOIN hospitals h ON h.hospital_id = d.hospital_id
        ORDER BY d.doctor_id
    ''')
    if err:
        return jsonify({'status': 'error', 'message': err}), 500
    return jsonify({'status': 'success', 'data': rows or []})


# =====================================================================
# RESOURCES
# =====================================================================

@api_bp.route('/resources', methods=['GET'])
def list_resources():
    rows, err = fetch_all('SELECT * FROM resources ORDER BY resource_id')
    if err:
        return jsonify({'status': 'error', 'message': err}), 500

    # Normalize column names for the frontend
    normalized = []
    for r in (rows or []):
        normalized.append({
            'resource_id': r.get('resource_id') or r.get('id'),
            'resource_name': r.get('resource_name') or r.get('name') or '—',
            'resource_type': r.get('resource_type') or r.get('type') or '—',
            'quantity_available': r.get('quantity_available') if r.get('quantity_available') is not None
                                  else r.get('quantity', 0),
            'unit': r.get('unit') or 'Units'
        })
    return jsonify({'status': 'success', 'data': normalized})

@api_bp.route('/resources/allocate', methods=['POST'])
def allocate_resource():
    data = request.get_json() or {}
    for f in ('incident_id', 'resource_id', 'quantity'):
        if not data.get(f):
            return jsonify({'status': 'error', 'message': f'{f} required'}), 400

    results, err = call_procedure('sp_allocate_resource', [
        data['incident_id'], data['resource_id'], data['quantity']
    ])
    if err:
        return jsonify({'status': 'error', 'message': err}), 500
    msg = results[0][0]['message'] if results and results[0] else 'Done'
    if 'ERROR' in str(msg) or 'Insufficient' in str(msg):
        return jsonify({'status': 'error', 'message': msg}), 400
    return jsonify({'status': 'success', 'message': msg})


# =====================================================================
# BLOOD STOCK
# =====================================================================

@api_bp.route('/blood', methods=['GET'])
def list_blood():
    rows, err = fetch_all('SELECT * FROM blood_stock ORDER BY blood_group')
    if err:
        return jsonify({'status': 'error', 'message': err}), 500
    total, _ = fetch_one('SELECT fn_total_blood_units() AS total')
    return jsonify({
        'status': 'success',
        'data': rows or [],
        'total_units': total['total'] if total else 0
    })


@api_bp.route('/blood/<blood_group>', methods=['PUT'])
def update_blood(blood_group):
    data = request.get_json() or {}
    if 'units_available' not in data:
        return jsonify({'status': 'error', 'message': 'units_available required'}), 400
    _, err = run_write(
        'UPDATE blood_stock SET units_available = %s WHERE blood_group = %s',
        (int(data['units_available']), blood_group)
    )
    if err:
        return jsonify({'status': 'error', 'message': err}), 500
    return jsonify({'status': 'success', 'message': 'Blood stock updated'})


# =====================================================================
# CREATE + RECALL (Fleet / Teams / Resources)
# =====================================================================

@api_bp.route('/ambulances', methods=['POST'])
def create_ambulance():
    data = request.get_json() or {}
    vehicle_number = (data.get('vehicle_number') or '').strip()
    amb_type = (data.get('type') or 'BLS').strip()
    location = (data.get('current_location') or 'Base Station').strip()
    if not vehicle_number:
        return jsonify({'status': 'error', 'message': 'vehicle_number required'}), 400

    last_id, err = run_write('''
        INSERT INTO ambulances (vehicle_number, type, status, current_location)
        VALUES (%s, %s, 'AVAILABLE', %s)
    ''', (vehicle_number, amb_type, location))
    if err:
        return jsonify({'status': 'error', 'message': err}), 500
    return jsonify({'status': 'success', 'ambulance_id': last_id}), 201


@api_bp.route('/ambulances/<int:ambulance_id>/recall', methods=['PUT'])
def recall_ambulance(ambulance_id):
    """Return a dispatched ambulance back to AVAILABLE."""
    _, err = run_write('''
        UPDATE ambulances
        SET status = 'AVAILABLE', current_location = 'Base Station'
        WHERE ambulance_id = %s
    ''', (ambulance_id,))
    if err:
        return jsonify({'status': 'error', 'message': err}), 500

    # Best-effort: close open dispatch rows if table exists
    run_write('''
        UPDATE dispatch_ambulances
        SET status = 'COMPLETED'
        WHERE ambulance_id = %s AND status IN ('EN_ROUTE', 'ON_SCENE', 'DISPATCHED')
    ''', (ambulance_id,))

    return jsonify({'status': 'success', 'message': 'Ambulance recalled'})


@api_bp.route('/teams', methods=['POST'])
def create_team():
    data = request.get_json() or {}
    name = (data.get('team_name') or '').strip()
    team_type = (data.get('team_type') or 'General').strip()
    members = int(data.get('members_count') or 5)
    if not name:
        return jsonify({'status': 'error', 'message': 'team_name required'}), 400

    last_id, err = run_write('''
        INSERT INTO rescue_teams (team_name, team_type, members_count, status)
        VALUES (%s, %s, %s, 'AVAILABLE')
    ''', (name, team_type, members))
    if err:
        return jsonify({'status': 'error', 'message': err}), 500
    return jsonify({'status': 'success', 'team_id': last_id}), 201


@api_bp.route('/teams/<int:team_id>/recall', methods=['PUT'])
def recall_team(team_id):
    _, err = run_write('''
        UPDATE rescue_teams SET status = 'AVAILABLE' WHERE team_id = %s
    ''', (team_id,))
    if err:
        return jsonify({'status': 'error', 'message': err}), 500

    run_write('''
        UPDATE dispatch_teams
        SET status = 'COMPLETED'
        WHERE team_id = %s AND status IN ('DEPLOYED', 'EN_ROUTE', 'ON_SCENE')
    ''', (team_id,))

    return jsonify({'status': 'success', 'message': 'Team recalled'})


@api_bp.route('/resources', methods=['POST'])
def create_resource():
    data = request.get_json() or {}
    # Accept multiple possible column naming styles
    name = (data.get('resource_name') or data.get('name') or '').strip()
    rtype = (data.get('resource_type') or data.get('type') or 'General').strip()
    qty = int(data.get('quantity_available') or data.get('quantity') or 0)
    unit = (data.get('unit') or 'Units').strip()
    if not name:
        return jsonify({'status': 'error', 'message': 'resource_name required'}), 400

    # Try common column sets used across schema versions
    last_id, err = run_write('''
        INSERT INTO resources (resource_name, resource_type, quantity_available, unit)
        VALUES (%s, %s, %s, %s)
    ''', (name, rtype, qty, unit))

    if err:
        # Fallback schema: name / type / quantity
        last_id, err = run_write('''
            INSERT INTO resources (name, type, quantity, unit)
            VALUES (%s, %s, %s, %s)
        ''', (name, rtype, qty, unit))

    if err:
        return jsonify({'status': 'error', 'message': err}), 500
    return jsonify({'status': 'success', 'resource_id': last_id}), 201


@api_bp.route('/hospitals', methods=['POST'])
def create_hospital():
    data = request.get_json() or {}
    name = (data.get('name') or '').strip()
    location = (data.get('location') or '').strip()
    total = int(data.get('total_beds') or 0)
    occupied = int(data.get('occupied_beds') or 0)
    if not name or total <= 0:
        return jsonify({'status': 'error', 'message': 'name and total_beds required'}), 400

    last_id, err = run_write('''
        INSERT INTO hospitals (name, location, total_beds, occupied_beds)
        VALUES (%s, %s, %s, %s)
    ''', (name, location, total, occupied))
    if err:
        return jsonify({'status': 'error', 'message': err}), 500
    return jsonify({'status': 'success', 'hospital_id': last_id}), 201

# =====================================================================
# ALERTS
# =====================================================================

@api_bp.route('/alerts', methods=['GET'])
def list_alerts():
    rows, err = fetch_all('''
        SELECT * FROM alerts ORDER BY alert_time DESC LIMIT 50
    ''')
    if err:
        return jsonify({'status': 'error', 'message': err}), 500
    return jsonify({'status': 'success', 'data': rows or []})


@api_bp.route('/alerts/<int:alert_id>/ack', methods=['PUT'])
def ack_alert(alert_id):
    _, err = run_write(
        'UPDATE alerts SET is_acknowledged = TRUE WHERE alert_id = %s',
        (alert_id,)
    )
    if err:
        return jsonify({'status': 'error', 'message': err}), 500
    return jsonify({'status': 'success', 'message': 'Alert acknowledged'})

@api_bp.route('/alerts', methods=['POST'])
def create_alert():
    data = request.get_json() or {}
    level = (data.get('alert_level') or 'INFO').upper()
    message = (data.get('message') or '').strip()
    if not message:
        return jsonify({'status': 'error', 'message': 'message required'}), 400
    if level not in ('CRITICAL', 'HIGH', 'INFO'):
        level = 'INFO'
    last_id, err = run_write('''
        INSERT INTO alerts (alert_level, message, is_acknowledged)
        VALUES (%s, %s, FALSE)
    ''', (level, message))
    if err:
        return jsonify({'status': 'error', 'message': err}), 500
    return jsonify({'status': 'success', 'alert_id': last_id}), 201