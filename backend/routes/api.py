"""
SENTINEL API routes — dashboard and module read endpoints.
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
        return cursor.lastrowid, None
    except Error as e:
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

    # Extra breakdowns
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

    # Normalize severity into fixed keys
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
               location_desc, latitude, longitude,
               (SELECT COUNT(*) FROM dispatch_ambulances da
                WHERE da.incident_id = i.incident_id
                  AND da.status IN ('EN_ROUTE','ON_SCENE')) AS units_on_scene
        FROM incidents i
        WHERE status IN ('ACTIVE', 'CONTAINED')
          AND latitude IS NOT NULL
          AND longitude IS NOT NULL
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

    results, err = call_procedure('sp_register_incident', [
        data['title'],
        data['incident_type'],
        data['severity'],
        data['location_desc'],
        data.get('latitude'),
        data.get('longitude')
    ])
    if err:
        return jsonify({'status': 'error', 'message': err}), 500
    return jsonify({'status': 'success', 'data': results[0][0] if results and results[0] else {}}), 201


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

    results, err = call_procedure('sp_admit_victim', [victim_id, hospital_id])
    if err:
        return jsonify({'status': 'error', 'message': err}), 500
    msg = results[0][0]['message'] if results and results[0] else 'Done'
    if 'ERROR' in str(msg):
        return jsonify({'status': 'error', 'message': msg}), 400
    return jsonify({'status': 'success', 'message': msg})


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
    rows, err = fetch_all('SELECT * FROM view_hospital_capacity')
    if err:
        return jsonify({'status': 'error', 'message': err}), 500
    return jsonify({'status': 'success', 'data': rows or []})


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
    return jsonify({'status': 'success', 'data': rows or []})


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