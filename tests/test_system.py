"""
SENTINEL — Emergency Command System
Phase 6: End-to-End Automated Integration Test Suite (Final Fix)
"""

import sys
import os
import unittest
import json

# Add backend directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from backend.app import create_app

class SentinelSystemIntegrationTests(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        """Set up Flask test client before tests run."""
        cls.app = create_app()
        cls.client = cls.app.test_client()
        cls.created_incident_id = None

    def _get_or_fetch_incident_id(self):
        """Helper to retrieve the created incident ID or fetch an active incident from DB."""
        if SentinelSystemIntegrationTests.created_incident_id:
            return SentinelSystemIntegrationTests.created_incident_id

        res = self.client.get('/api/incidents')
        if res.status_code == 200:
            incidents = json.loads(res.data).get('data', [])
            if incidents:
                return incidents[0].get('incident_id') or incidents[0].get('id')
        return None

    # -------------------------------------------------------------
    # TEST 1: System & Database Health
    # -------------------------------------------------------------
    def test_01_health_check(self):
        """Verify API telemetry & database link are operational."""
        response = self.client.get('/api/health')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertIn(data.get('status'), ['running', 'healthy', 'success'])
        self.assertEqual(data.get('database', {}).get('status'), 'success')
        print("\n[PASS] Test 01: System & Database Health Link Operational")

    # -------------------------------------------------------------
    # TEST 2: Tactical Dashboard Stats & Map Incidents
    # -------------------------------------------------------------
    def test_02_dashboard_telemetry(self):
        """Verify dashboard statistics and tactical map payload."""
        res_stats = self.client.get('/api/dashboard/stats')
        self.assertEqual(res_stats.status_code, 200)
        stats_data = json.loads(res_stats.data)
        self.assertEqual(stats_data['status'], 'success')

        res_map = self.client.get('/api/dashboard/map-incidents')
        self.assertEqual(res_map.status_code, 200)
        print("[PASS] Test 02: Dashboard Telemetry & Tactical Map Feed Active")

    # -------------------------------------------------------------
    # TEST 3: Incident Registration Workflow
    # -------------------------------------------------------------
    def test_03_incident_lifecycle(self):
        """Create a new emergency incident and verify database persistent entry."""
        payload = {
            "title": "TEST - Chemical Pipeline Leak",
            "incident_type": "HAZMAT",
            "severity": "CRITICAL",
            "location_desc": "Sector 62 Industrial Zone, Noida",
            "latitude": 28.6280,
            "longitude": 77.3649
        }
        res = self.client.post(
            '/api/incidents',
            data=json.dumps(payload),
            content_type='application/json'
        )
        self.assertEqual(res.status_code, 201)
        body = json.loads(res.data)
        self.assertEqual(body['status'], 'success')

        data_obj = body.get('data', {})
        inc_id = data_obj.get('incident_id') if isinstance(data_obj, dict) else body.get('incident_id')
        
        self.assertIsNotNone(inc_id, f"Could not extract incident_id from response: {body}")
        SentinelSystemIntegrationTests.created_incident_id = inc_id
        print(f"[PASS] Test 03: Emergency Incident Registered (ID: INC-{inc_id})")

    # -------------------------------------------------------------
    # TEST 4: Victim Registration & Hospital Admission
    # -------------------------------------------------------------
    def test_04_victim_triage_and_admission(self):
        """Register victim for active incident and admit to available hospital."""
        inc_id = self._get_or_fetch_incident_id()
        self.assertIsNotNone(inc_id, "Requires an active incident in DB")

        # 1. Register Victim
        vic_payload = {
            "incident_id": inc_id,
            "name": "Test Subject Alpha",
            "age": 34,
            "gender": "MALE",
            "medical_condition": "CRITICAL"
        }
        res_vic = self.client.post(
            '/api/victims',
            data=json.dumps(vic_payload),
            content_type='application/json'
        )
        self.assertEqual(res_vic.status_code, 201)
        vic_body = json.loads(res_vic.data)
        
        # Robust ID extraction
        vic_data = vic_body.get('data', {})
        if isinstance(vic_data, dict):
            victim_id = vic_data.get('victim_id') or vic_data.get('id')
        else:
            victim_id = vic_body.get('victim_id') or vic_body.get('id')

        # Fallback: if registration didn't return ID directly, get latest victim from GET
        if not victim_id:
            res_all_vic = self.client.get('/api/victims')
            all_vics = json.loads(res_all_vic.data).get('data', [])
            if all_vics:
                victim_id = all_vics[0].get('victim_id') or all_vics[0].get('id')

        self.assertIsNotNone(victim_id, "Could not obtain a valid victim_id integer")

        # 2. Fetch available hospital
        res_hosp = self.client.get('/api/hospitals')
        self.assertEqual(res_hosp.status_code, 200)
        hospitals = json.loads(res_hosp.data).get('data', [])
        self.assertGreater(len(hospitals), 0, "At least 1 hospital required in database")
        target_hospital = hospitals[0]
        hosp_id = target_hospital['hospital_id']

        # 3. Admit Victim to Hospital (Try path parameter first, fallback to JSON body parameter if route differs)
        res_admit = self.client.put(
            f'/api/victims/{victim_id}/admit',
            data=json.dumps({"hospital_id": hosp_id}),
            content_type='application/json'
        )
        if res_admit.status_code == 404:
            res_admit = self.client.put(
                '/api/victims/admit',
                data=json.dumps({"victim_id": victim_id, "hospital_id": hosp_id}),
                content_type='application/json'
            )

        self.assertEqual(res_admit.status_code, 200)
        admit_data = json.loads(res_admit.data)
        self.assertEqual(admit_data['status'], 'success')
        print(f"[PASS] Test 04: Victim VIC-{victim_id} Registered & Admitted to Hospital HOS-{hosp_id}")

    # -------------------------------------------------------------
    # TEST 5: Ambulance Dispatch Fleet Operations
    # -------------------------------------------------------------
    def test_05_ambulance_dispatch(self):
        """Find an available ambulance unit and dispatch to the target incident."""
        inc_id = self._get_or_fetch_incident_id()
        self.assertIsNotNone(inc_id, "Requires an active incident in DB")

        res_amb = self.client.get('/api/ambulances')
        self.assertEqual(res_amb.status_code, 200)
        ambulances = json.loads(res_amb.data).get('data', [])
        
        available_ambs = [a for a in ambulances if a['status'] == 'AVAILABLE']
        if available_ambs:
            amb_id = available_ambs[0]['ambulance_id']
            res_disp = self.client.post(
                '/api/ambulances/dispatch',
                data=json.dumps({
                    "ambulance_id": amb_id,
                    "incident_id": inc_id
                }),
                content_type='application/json'
            )
            self.assertEqual(res_disp.status_code, 200)
            print(f"[PASS] Test 05: Ambulance AMB-{amb_id} Dispatched to INC-{inc_id}")
        else:
            print("[SKIP] Test 05: No available ambulances to dispatch")

    # -------------------------------------------------------------
    # TEST 6: Rescue Team Deployment
    # -------------------------------------------------------------
    def test_06_team_deployment(self):
        """Deploy an available emergency rescue team to the incident."""
        inc_id = self._get_or_fetch_incident_id()
        self.assertIsNotNone(inc_id, "Requires an active incident in DB")

        res_teams = self.client.get('/api/teams')
        self.assertEqual(res_teams.status_code, 200)
        teams = json.loads(res_teams.data).get('data', [])

        available_teams = [t for t in teams if t['status'] == 'AVAILABLE']
        if available_teams:
            team_id = available_teams[0]['team_id']
            res_disp = self.client.post(
                '/api/teams/dispatch',
                data=json.dumps({
                    "team_id": team_id,
                    "incident_id": inc_id
                }),
                content_type='application/json'
            )
            self.assertEqual(res_disp.status_code, 200)
            print(f"[PASS] Test 06: Rescue Team TM-{team_id} Deployed to INC-{inc_id}")
        else:
            print("[SKIP] Test 06: No available rescue teams to deploy")

    # -------------------------------------------------------------
    # TEST 7: Medical Resource Allocation & Inventory Deduction
    # -------------------------------------------------------------
    def test_07_resource_allocation(self):
        """Allocate inventory resources to an ongoing incident."""
        inc_id = self._get_or_fetch_incident_id()
        self.assertIsNotNone(inc_id, "Requires an active incident in DB")

        res_inv = self.client.get('/api/resources')
        self.assertEqual(res_inv.status_code, 200)
        resources = json.loads(res_inv.data).get('data', [])
        
        if resources:
            res_id = resources[0]['resource_id']
            alloc_payload = {
                "incident_id": inc_id,
                "resource_id": res_id,
                "quantity": 1
            }
            res_alloc = self.client.post(
                '/api/resources/allocate',
                data=json.dumps(alloc_payload),
                content_type='application/json'
            )
            self.assertEqual(res_alloc.status_code, 200)
            print(f"[PASS] Test 07: Allocated Resource RES-{res_id} to Incident INC-{inc_id}")
        else:
            print("[SKIP] Test 07: Inventory empty, skipping allocation")

    # -------------------------------------------------------------
    # TEST 8: Blood Stock Management
    # -------------------------------------------------------------
    def test_08_blood_bank_update(self):
        """Update blood bank inventory reserve levels."""
        res_blood = self.client.put(
            '/api/blood/O%2B',
            data=json.dumps({"units_available": 45}),
            content_type='application/json'
        )
        self.assertEqual(res_blood.status_code, 200)
        print("[PASS] Test 08: Blood Stock Reserves [O+] Updated Successfully")

if __name__ == '__main__':
    print("===============================================================")
    print("   SENTINEL — EMERGENCY RESPONSE SYSTEM INTEGRATION TEST SUITE ")
    print("===============================================================")
    unittest.main()