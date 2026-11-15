-- ==============================================================================
-- SMART DISASTER RESPONSE & EMERGENCY RESOURCE MANAGEMENT SYSTEM
-- PHASE 2: DATABASE SCHEMA DEFINITION
-- ==============================================================================

-- 1. Create and Select Database
CREATE DATABASE IF NOT EXISTS disaster_response;
USE disaster_response;

-- ==============================================================================
-- INDEPENDENT TABLES (No Foreign Keys)
-- ==============================================================================

-- Hospitals Table
CREATE TABLE hospitals (
    hospital_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    location VARCHAR(255) NOT NULL,
    contact_number VARCHAR(20) NOT NULL,
    total_beds INT NOT NULL CHECK (total_beds >= 0),
    available_beds INT NOT NULL CHECK (available_beds >= 0),
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Blood Stock Table (Global Inventory)
CREATE TABLE blood_stock (
    blood_group VARCHAR(5) PRIMARY KEY,
    units_available INT NOT NULL DEFAULT 0 CHECK (units_available >= 0),
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Emergency Resources (Equipment, Supplies)
CREATE TABLE resources (
    resource_id INT AUTO_INCREMENT PRIMARY KEY,
    resource_name VARCHAR(100) NOT NULL,
    category ENUM('MEDICAL', 'RESCUE', 'SURVIVAL', 'LOGISTICS') NOT NULL,
    total_quantity INT NOT NULL CHECK (total_quantity >= 0),
    available_quantity INT NOT NULL CHECK (available_quantity >= 0)
);

-- Ambulances Fleet
CREATE TABLE ambulances (
    ambulance_id INT AUTO_INCREMENT PRIMARY KEY,
    vehicle_number VARCHAR(20) UNIQUE NOT NULL,
    type ENUM('ALS', 'BLS', 'NEONATAL') NOT NULL COMMENT 'Advanced, Basic, or Neonatal Life Support',
    status ENUM('AVAILABLE', 'DISPATCHED', 'MAINTENANCE') DEFAULT 'AVAILABLE',
    current_location VARCHAR(100)
);

-- Rescue Teams
CREATE TABLE rescue_teams (
    team_id INT AUTO_INCREMENT PRIMARY KEY,
    team_name VARCHAR(100) UNIQUE NOT NULL,
    specialization ENUM('FIRE', 'HAZMAT', 'MEDICAL', 'SEARCH_RESCUE', 'GENERAL') NOT NULL,
    member_count INT NOT NULL CHECK (member_count > 0),
    status ENUM('AVAILABLE', 'DEPLOYED', 'RESTING') DEFAULT 'AVAILABLE'
);

-- ==============================================================================
-- DEPENDENT TABLES (Contains Foreign Keys)
-- ==============================================================================

-- Doctors Table
CREATE TABLE doctors (
    doctor_id INT AUTO_INCREMENT PRIMARY KEY,
    hospital_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    specialization VARCHAR(100) NOT NULL,
    contact_number VARCHAR(20),
    is_available BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (hospital_id) REFERENCES hospitals(hospital_id) ON DELETE CASCADE
);

-- Incidents (Core Table)
-- Auto-increment starts at 2840 to match our UI aesthetic (e.g., INC-2847)
CREATE TABLE incidents (
    incident_id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(100) NOT NULL,
    incident_type ENUM('WILDFIRE', 'EARTHQUAKE', 'FLOOD', 'TORNADO', 'HAZMAT', 'ACCIDENT', 'OTHER') NOT NULL,
    severity ENUM('CRITICAL', 'HIGH', 'MODERATE', 'LOW') NOT NULL,
    status ENUM('ACTIVE', 'CONTAINED', 'RESOLVED') DEFAULT 'ACTIVE',
    location_desc VARCHAR(255) NOT NULL,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    reported_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    resolved_time DATETIME NULL
) AUTO_INCREMENT = 2840;

-- Victims
CREATE TABLE victims (
    victim_id INT AUTO_INCREMENT PRIMARY KEY,
    incident_id INT NOT NULL,
    name VARCHAR(100) DEFAULT 'UNKNOWN',
    age INT,
    gender ENUM('MALE', 'FEMALE', 'OTHER', 'UNKNOWN') DEFAULT 'UNKNOWN',
    medical_condition ENUM('CRITICAL', 'SEVERE', 'STABLE', 'DECEASED') NOT NULL,
    hospital_id INT NULL COMMENT 'Null if not yet assigned/admitted',
    assigned_time DATETIME NULL,
    FOREIGN KEY (incident_id) REFERENCES incidents(incident_id) ON DELETE CASCADE,
    FOREIGN KEY (hospital_id) REFERENCES hospitals(hospital_id) ON DELETE SET NULL
);

-- Emergency Alerts (For the UI Feed)
CREATE TABLE alerts (
    alert_id INT AUTO_INCREMENT PRIMARY KEY,
    incident_id INT NULL,
    alert_level ENUM('CRITICAL', 'HIGH', 'MODERATE', 'INFO') NOT NULL,
    message VARCHAR(255) NOT NULL,
    alert_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_acknowledged BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (incident_id) REFERENCES incidents(incident_id) ON DELETE CASCADE
);

-- ==============================================================================
-- MAPPING / DISPATCH TABLES (Many-to-Many Relationships)
-- ==============================================================================

-- Ambulance Dispatch Logs
CREATE TABLE dispatch_ambulances (
    dispatch_id INT AUTO_INCREMENT PRIMARY KEY,
    incident_id INT NOT NULL,
    ambulance_id INT NOT NULL,
    dispatch_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    arrival_time DATETIME NULL,
    completion_time DATETIME NULL,
    status ENUM('EN_ROUTE', 'ON_SCENE', 'COMPLETED', 'CANCELLED') DEFAULT 'EN_ROUTE',
    FOREIGN KEY (incident_id) REFERENCES incidents(incident_id) ON DELETE CASCADE,
    FOREIGN KEY (ambulance_id) REFERENCES ambulances(ambulance_id) ON DELETE CASCADE
);

-- Rescue Team Dispatch Logs
CREATE TABLE dispatch_teams (
    dispatch_id INT AUTO_INCREMENT PRIMARY KEY,
    incident_id INT NOT NULL,
    team_id INT NOT NULL,
    dispatch_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    completion_time DATETIME NULL,
    status ENUM('DEPLOYED', 'COMPLETED', 'RECALLED') DEFAULT 'DEPLOYED',
    FOREIGN KEY (incident_id) REFERENCES incidents(incident_id) ON DELETE CASCADE,
    FOREIGN KEY (team_id) REFERENCES rescue_teams(team_id) ON DELETE CASCADE
);

-- Resource Allocations
CREATE TABLE resource_allocations (
    allocation_id INT AUTO_INCREMENT PRIMARY KEY,
    incident_id INT NOT NULL,
    resource_id INT NOT NULL,
    quantity_allocated INT NOT NULL CHECK (quantity_allocated > 0),
    allocation_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    status ENUM('ALLOCATED', 'RETURNED', 'CONSUMED') DEFAULT 'ALLOCATED',
    FOREIGN KEY (incident_id) REFERENCES incidents(incident_id) ON DELETE CASCADE,
    FOREIGN KEY (resource_id) REFERENCES resources(resource_id) ON DELETE CASCADE
);

-- ==============================================================================
-- CREATE VIEWS FOR THE DASHBOARD
-- ==============================================================================

-- View for Dashboard Statistics
CREATE VIEW view_dashboard_stats AS
SELECT 
    (SELECT COUNT(*) FROM incidents WHERE status = 'ACTIVE') AS active_incidents,
    (SELECT COUNT(*) FROM victims) AS total_victims,
    (SELECT COUNT(*) FROM ambulances WHERE status = 'AVAILABLE') AS available_ambulances,
    (SELECT COUNT(*) FROM rescue_teams WHERE status = 'DEPLOYED') AS deployed_teams,
    (SELECT SUM(available_beds) FROM hospitals) AS available_beds,
    (SELECT COUNT(*) FROM alerts WHERE alert_time >= NOW() - INTERVAL 24 HOUR) AS recent_alerts;

USE disaster_response;

-- ==============================================================================
-- PHASE 3A: SAMPLE DATA
-- ==============================================================================

-- Hospitals
INSERT INTO hospitals (name, location, contact_number, total_beds, available_beds) VALUES
('City General Hospital', 'Downtown Sector 3', '555-0101', 120, 45),
('St. Mary Medical Center', 'North Ridge', '555-0102', 80, 12),
('Riverside Trauma Center', 'East Bank', '555-0103', 150, 67),
('Valley Emergency Hospital', 'West Valley', '555-0104', 60, 8),
('Metro Care Hospital', 'Central Plaza', '555-0105', 100, 34);

-- Blood Stock
INSERT INTO blood_stock (blood_group, units_available) VALUES
('A+', 45),
('A-', 12),
('B+', 38),
('B-', 8),
('AB+', 15),
('AB-', 5),
('O+', 62),
('O-', 22);

-- Resources
INSERT INTO resources (resource_name, category, total_quantity, available_quantity) VALUES
('First Aid Kits', 'MEDICAL', 200, 145),
('Stretchers', 'MEDICAL', 80, 52),
('Oxygen Cylinders', 'MEDICAL', 100, 67),
('Fire Extinguishers', 'RESCUE', 150, 120),
('Rescue Ropes', 'RESCUE', 90, 70),
('Thermal Blankets', 'SURVIVAL', 300, 210),
('Water Purification Units', 'SURVIVAL', 40, 28),
('Portable Generators', 'LOGISTICS', 25, 15),
('Emergency Tents', 'LOGISTICS', 50, 32);

-- Ambulances
INSERT INTO ambulances (vehicle_number, type, status, current_location) VALUES
('AMB-101', 'ALS', 'AVAILABLE', 'Station Alpha'),
('AMB-102', 'ALS', 'DISPATCHED', 'Sector 07-A'),
('AMB-103', 'BLS', 'AVAILABLE', 'Station Beta'),
('AMB-104', 'BLS', 'AVAILABLE', 'Station Alpha'),
('AMB-105', 'NEONATAL', 'AVAILABLE', 'Station Gamma'),
('AMB-106', 'ALS', 'MAINTENANCE', 'Workshop'),
('AMB-107', 'BLS', 'DISPATCHED', 'Sector 07-A'),
('AMB-108', 'ALS', 'AVAILABLE', 'Station Beta');

-- Rescue Teams
INSERT INTO rescue_teams (team_name, specialization, member_count, status) VALUES
('Alpha Fire Squad', 'FIRE', 12, 'DEPLOYED'),
('Hazmat Unit 1', 'HAZMAT', 8, 'AVAILABLE'),
('Medical Rapid Response', 'MEDICAL', 10, 'DEPLOYED'),
('Search & Rescue Bravo', 'SEARCH_RESCUE', 15, 'AVAILABLE'),
('Charlie General Unit', 'GENERAL', 10, 'AVAILABLE'),
('Delta Fire Squad', 'FIRE', 12, 'RESTING');

-- Doctors
INSERT INTO doctors (hospital_id, name, specialization, contact_number, is_available) VALUES
(1, 'Dr. Sarah Chen', 'Trauma Surgery', '555-1001', TRUE),
(1, 'Dr. James Wilson', 'Emergency Medicine', '555-1002', TRUE),
(2, 'Dr. Priya Sharma', 'Cardiology', '555-1003', FALSE),
(2, 'Dr. Michael Torres', 'Orthopedics', '555-1004', TRUE),
(3, 'Dr. Emily Watson', 'Neurosurgery', '555-1005', TRUE),
(3, 'Dr. Raj Patel', 'Burn Specialist', '555-1006', TRUE),
(4, 'Dr. Lisa Anderson', 'Pediatrics', '555-1007', TRUE),
(5, 'Dr. David Kim', 'Emergency Medicine', '555-1008', FALSE);

-- Incidents (IDs will start from 2840)
INSERT INTO incidents (title, incident_type, severity, status, location_desc, latitude, longitude, reported_time) VALUES
('Sierra Ridge Wildfire', 'WILDFIRE', 'CRITICAL', 'ACTIVE', 'Sierra Nevada Foothills, Sector 07-A', 37.86510000, -119.53830000, NOW() - INTERVAL 2 HOUR),
('Highway 9 Collision', 'ACCIDENT', 'HIGH', 'ACTIVE', 'Highway 9 Mile Marker 42', 37.44190000, -122.14300000, NOW() - INTERVAL 90 MINUTE),
('Downtown Chemical Spill', 'HAZMAT', 'MODERATE', 'CONTAINED', 'Industrial Zone Block C', 37.77490000, -122.41940000, NOW() - INTERVAL 5 HOUR),
('Riverbank Flooding', 'FLOOD', 'HIGH', 'ACTIVE', 'East River District', 37.80440000, -122.27120000, NOW() - INTERVAL 3 HOUR),
('Apartment Structure Fire', 'WILDFIRE', 'MODERATE', 'RESOLVED', 'Oak Street Residential', 37.33820000, -121.88630000, NOW() - INTERVAL 1 DAY);

-- Victims
INSERT INTO victims (incident_id, name, age, gender, medical_condition, hospital_id, assigned_time) VALUES
(2840, 'John Martinez', 34, 'MALE', 'CRITICAL', 3, NOW() - INTERVAL 1 HOUR),
(2840, 'Anna Kowalski', 28, 'FEMALE', 'SEVERE', 3, NOW() - INTERVAL 1 HOUR),
(2840, 'Unknown Male', NULL, 'MALE', 'STABLE', 1, NOW() - INTERVAL 45 MINUTE),
(2841, 'Robert Chen', 45, 'MALE', 'CRITICAL', 1, NOW() - INTERVAL 70 MINUTE),
(2841, 'Maria Garcia', 31, 'FEMALE', 'SEVERE', 1, NOW() - INTERVAL 70 MINUTE),
(2841, 'James Lee', 52, 'MALE', 'STABLE', 2, NOW() - INTERVAL 60 MINUTE),
(2842, 'Tom Bradley', 40, 'MALE', 'STABLE', NULL, NULL),
(2843, 'Sophie Nguyen', 22, 'FEMALE', 'SEVERE', 5, NOW() - INTERVAL 2 HOUR),
(2843, 'Unknown Child', 8, 'UNKNOWN', 'STABLE', 4, NOW() - INTERVAL 2 HOUR),
(2844, 'Helen Carter', 67, 'FEMALE', 'STABLE', 2, NOW() - INTERVAL 20 HOUR);

-- Alerts
INSERT INTO alerts (incident_id, alert_level, message, alert_time, is_acknowledged) VALUES
(2840, 'CRITICAL', 'Wildfire expanding north — additional units requested', NOW() - INTERVAL 30 MINUTE, FALSE),
(2840, 'HIGH', 'Air quality hazardous in Sector 07-A', NOW() - INTERVAL 50 MINUTE, FALSE),
(2841, 'HIGH', 'Multi-vehicle pileup — 3 critical patients', NOW() - INTERVAL 80 MINUTE, TRUE),
(2842, 'MODERATE', 'Hazmat containment successful, monitoring ongoing', NOW() - INTERVAL 2 HOUR, TRUE),
(2843, 'HIGH', 'Flood waters rising — evacuation recommended', NOW() - INTERVAL 2 HOUR, FALSE),
(NULL, 'INFO', 'CHARLIE-7 cleared readiness check, fully operational', NOW() - INTERVAL 3 HOUR, TRUE),
(NULL, 'INFO', 'Blood stock O- below threshold at Metro Care', NOW() - INTERVAL 4 HOUR, FALSE);

-- Dispatch Ambulances
INSERT INTO dispatch_ambulances (incident_id, ambulance_id, dispatch_time, arrival_time, status) VALUES
(2840, 2, NOW() - INTERVAL 100 MINUTE, NOW() - INTERVAL 85 MINUTE, 'ON_SCENE'),
(2840, 7, NOW() - INTERVAL 90 MINUTE, NOW() - INTERVAL 75 MINUTE, 'ON_SCENE'),
(2841, 1, NOW() - INTERVAL 85 MINUTE, NOW() - INTERVAL 70 MINUTE, 'COMPLETED'),
(2843, 3, NOW() - INTERVAL 150 MINUTE, NOW() - INTERVAL 130 MINUTE, 'ON_SCENE');

-- Update ambulance statuses to match dispatches (AMB-101 completed so set available again if needed)
UPDATE ambulances SET status = 'AVAILABLE' WHERE ambulance_id = 1;
UPDATE ambulances SET status = 'DISPATCHED' WHERE ambulance_id IN (2, 7, 3);

-- Dispatch Teams
INSERT INTO dispatch_teams (incident_id, team_id, dispatch_time, status) VALUES
(2840, 1, NOW() - INTERVAL 110 MINUTE, 'DEPLOYED'),
(2840, 3, NOW() - INTERVAL 100 MINUTE, 'DEPLOYED'),
(2842, 2, NOW() - INTERVAL 4 HOUR, 'COMPLETED'),
(2843, 4, NOW() - INTERVAL 160 MINUTE, 'DEPLOYED');

-- Resource Allocations
INSERT INTO resource_allocations (incident_id, resource_id, quantity_allocated, status) VALUES
(2840, 1, 20, 'ALLOCATED'),
(2840, 4, 15, 'ALLOCATED'),
(2840, 6, 40, 'ALLOCATED'),
(2841, 1, 10, 'CONSUMED'),
(2841, 2, 5, 'ALLOCATED'),
(2843, 6, 30, 'ALLOCATED'),
(2843, 7, 5, 'ALLOCATED');

-- Reduce available quantities for allocated resources
UPDATE resources SET available_quantity = available_quantity - 20 WHERE resource_id = 1;
UPDATE resources SET available_quantity = available_quantity - 15 WHERE resource_id = 4;
UPDATE resources SET available_quantity = available_quantity - 40 WHERE resource_id = 6;
UPDATE resources SET available_quantity = available_quantity - 10 WHERE resource_id = 1;
UPDATE resources SET available_quantity = available_quantity - 5 WHERE resource_id = 2;
UPDATE resources SET available_quantity = available_quantity - 30 WHERE resource_id = 6;
UPDATE resources SET available_quantity = available_quantity - 5 WHERE resource_id = 7;

-- Reduce hospital beds for admitted victims
UPDATE hospitals SET available_beds = available_beds - 2 WHERE hospital_id = 3;
UPDATE hospitals SET available_beds = available_beds - 2 WHERE hospital_id = 1;
UPDATE hospitals SET available_beds = available_beds - 1 WHERE hospital_id = 2;
UPDATE hospitals SET available_beds = available_beds - 1 WHERE hospital_id = 5;
UPDATE hospitals SET available_beds = available_beds - 1 WHERE hospital_id = 4;


-- ==============================================================================
-- PHASE 3B: ADDITIONAL VIEWS
-- ==============================================================================

CREATE OR REPLACE VIEW view_active_incidents AS
SELECT 
    i.incident_id,
    i.title,
    i.incident_type,
    i.severity,
    i.status,
    i.location_desc,
    i.latitude,
    i.longitude,
    i.reported_time,
    (SELECT COUNT(*) FROM victims v WHERE v.incident_id = i.incident_id) AS victim_count,
    (SELECT COUNT(*) FROM dispatch_ambulances da WHERE da.incident_id = i.incident_id AND da.status IN ('EN_ROUTE','ON_SCENE')) AS units_on_scene
FROM incidents i
WHERE i.status IN ('ACTIVE', 'CONTAINED')
ORDER BY 
    FIELD(i.severity, 'CRITICAL', 'HIGH', 'MODERATE', 'LOW'),
    i.reported_time DESC;

CREATE OR REPLACE VIEW view_ambulance_status AS
SELECT 
    status,
    COUNT(*) AS count
FROM ambulances
GROUP BY status;

CREATE OR REPLACE VIEW view_hospital_capacity AS
SELECT 
    hospital_id,
    name,
    location,
    total_beds,
    available_beds,
    (total_beds - available_beds) AS occupied_beds,
    ROUND(((total_beds - available_beds) / total_beds) * 100, 1) AS occupancy_pct
FROM hospitals
ORDER BY occupancy_pct DESC;

CREATE OR REPLACE VIEW view_severity_breakdown AS
SELECT 
    severity,
    COUNT(*) AS count
FROM incidents
WHERE status = 'ACTIVE'
GROUP BY severity;

CREATE OR REPLACE VIEW view_recent_responses AS
SELECT 
    da.dispatch_id AS resp_id,
    da.incident_id,
    i.title AS incident_title,
    a.vehicle_number AS unit,
    da.dispatch_time,
    da.arrival_time,
    TIMESTAMPDIFF(MINUTE, da.dispatch_time, da.arrival_time) AS response_minutes,
    da.status
FROM dispatch_ambulances da
JOIN incidents i ON i.incident_id = da.incident_id
JOIN ambulances a ON a.ambulance_id = da.ambulance_id
ORDER BY da.dispatch_time DESC;


-- ==============================================================================
-- PHASE 3C: STORED PROCEDURES
-- ==============================================================================

DELIMITER //

-- Register a new incident
CREATE PROCEDURE sp_register_incident(
    IN p_title VARCHAR(100),
    IN p_type VARCHAR(20),
    IN p_severity VARCHAR(20),
    IN p_location VARCHAR(255),
    IN p_lat DECIMAL(10,8),
    IN p_lng DECIMAL(11,8)
)
BEGIN
    DECLARE new_id INT;

    INSERT INTO incidents (title, incident_type, severity, status, location_desc, latitude, longitude)
    VALUES (p_title, p_type, p_severity, 'ACTIVE', p_location, p_lat, p_lng);

    SET new_id = LAST_INSERT_ID();

    INSERT INTO alerts (incident_id, alert_level, message)
    VALUES (
        new_id,
        p_severity,
        CONCAT('NEW ', p_severity, ' INCIDENT: ', p_title, ' at ', p_location)
    );

    SELECT new_id AS incident_id, 'Incident registered successfully' AS message;
END //

-- Dispatch an ambulance to an incident (with transaction + validation)
CREATE PROCEDURE sp_dispatch_ambulance(
    IN p_incident_id INT,
    IN p_ambulance_id INT
)
BEGIN
    DECLARE v_amb_status VARCHAR(20);
    DECLARE v_inc_status VARCHAR(20);

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        SELECT 'ERROR: Dispatch failed. Transaction rolled back.' AS message;
    END;

    START TRANSACTION;

    SELECT status INTO v_amb_status FROM ambulances WHERE ambulance_id = p_ambulance_id FOR UPDATE;
    SELECT status INTO v_inc_status FROM incidents WHERE incident_id = p_incident_id FOR UPDATE;

    IF v_amb_status IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Ambulance not found';
    END IF;

    IF v_inc_status IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Incident not found';
    END IF;

    IF v_amb_status != 'AVAILABLE' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Ambulance is not available';
    END IF;

    IF v_inc_status = 'RESOLVED' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Cannot dispatch to a resolved incident';
    END IF;

    INSERT INTO dispatch_ambulances (incident_id, ambulance_id, status)
    VALUES (p_incident_id, p_ambulance_id, 'EN_ROUTE');

    UPDATE ambulances SET status = 'DISPATCHED' WHERE ambulance_id = p_ambulance_id;

    INSERT INTO alerts (incident_id, alert_level, message)
    VALUES (p_incident_id, 'INFO', CONCAT('Ambulance #', p_ambulance_id, ' dispatched'));

    COMMIT;
    SELECT 'Ambulance dispatched successfully' AS message;
END //

-- Admit a victim to a hospital (updates bed count)
CREATE PROCEDURE sp_admit_victim(
    IN p_victim_id INT,
    IN p_hospital_id INT
)
BEGIN
    DECLARE v_beds INT;

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        SELECT 'ERROR: Admission failed. Rolled back.' AS message;
    END;

    START TRANSACTION;

    SELECT available_beds INTO v_beds FROM hospitals WHERE hospital_id = p_hospital_id FOR UPDATE;

    IF v_beds IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Hospital not found';
    END IF;

    IF v_beds <= 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'No available beds at this hospital';
    END IF;

    UPDATE victims
    SET hospital_id = p_hospital_id, assigned_time = NOW()
    WHERE victim_id = p_victim_id;

    UPDATE hospitals
    SET available_beds = available_beds - 1
    WHERE hospital_id = p_hospital_id;

    COMMIT;
    SELECT 'Victim admitted successfully' AS message;
END //

-- Get full incident report (joins)
CREATE PROCEDURE sp_incident_report(IN p_incident_id INT)
BEGIN
    -- Incident details
    SELECT * FROM incidents WHERE incident_id = p_incident_id;

    -- Victims
    SELECT v.*, h.name AS hospital_name
    FROM victims v
    LEFT JOIN hospitals h ON h.hospital_id = v.hospital_id
    WHERE v.incident_id = p_incident_id;

    -- Dispatched ambulances
    SELECT da.*, a.vehicle_number, a.type
    FROM dispatch_ambulances da
    JOIN ambulances a ON a.ambulance_id = da.ambulance_id
    WHERE da.incident_id = p_incident_id;

    -- Dispatched teams
    SELECT dt.*, t.team_name, t.specialization
    FROM dispatch_teams dt
    JOIN rescue_teams t ON t.team_id = dt.team_id
    WHERE dt.incident_id = p_incident_id;

    -- Resources
    SELECT ra.*, r.resource_name, r.category
    FROM resource_allocations ra
    JOIN resources r ON r.resource_id = ra.resource_id
    WHERE ra.incident_id = p_incident_id;
END //

-- Allocate resource to incident
CREATE PROCEDURE sp_allocate_resource(
    IN p_incident_id INT,
    IN p_resource_id INT,
    IN p_qty INT
)
BEGIN
    DECLARE v_available INT;

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        SELECT 'ERROR: Allocation failed. Rolled back.' AS message;
    END;

    START TRANSACTION;

    SELECT available_quantity INTO v_available
    FROM resources WHERE resource_id = p_resource_id FOR UPDATE;

    IF v_available IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Resource not found';
    END IF;

    IF v_available < p_qty THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Insufficient resource quantity';
    END IF;

    INSERT INTO resource_allocations (incident_id, resource_id, quantity_allocated)
    VALUES (p_incident_id, p_resource_id, p_qty);

    UPDATE resources
    SET available_quantity = available_quantity - p_qty
    WHERE resource_id = p_resource_id;

    COMMIT;
    SELECT 'Resource allocated successfully' AS message;
END //

DELIMITER ;


-- ==============================================================================
-- PHASE 3D: FUNCTIONS
-- ==============================================================================

DELIMITER //

-- Calculate average ambulance response time (minutes) for an incident
CREATE FUNCTION fn_avg_response_time(p_incident_id INT)
RETURNS DECIMAL(10,2)
DETERMINISTIC
READS SQL DATA
BEGIN
    DECLARE avg_time DECIMAL(10,2);

    SELECT AVG(TIMESTAMPDIFF(MINUTE, dispatch_time, arrival_time))
    INTO avg_time
    FROM dispatch_ambulances
    WHERE incident_id = p_incident_id
      AND arrival_time IS NOT NULL;

    RETURN IFNULL(avg_time, 0);
END //

-- Get available bed count for a hospital
CREATE FUNCTION fn_available_beds(p_hospital_id INT)
RETURNS INT
DETERMINISTIC
READS SQL DATA
BEGIN
    DECLARE beds INT;
    SELECT available_beds INTO beds FROM hospitals WHERE hospital_id = p_hospital_id;
    RETURN IFNULL(beds, 0);
END //

-- Count active incidents by severity
CREATE FUNCTION fn_count_by_severity(p_severity VARCHAR(20))
RETURNS INT
DETERMINISTIC
READS SQL DATA
BEGIN
    DECLARE cnt INT;
    SELECT COUNT(*) INTO cnt
    FROM incidents
    WHERE severity = p_severity AND status = 'ACTIVE';
    RETURN IFNULL(cnt, 0);
END //

-- Total blood units available
CREATE FUNCTION fn_total_blood_units()
RETURNS INT
DETERMINISTIC
READS SQL DATA
BEGIN
    DECLARE total INT;
    SELECT SUM(units_available) INTO total FROM blood_stock;
    RETURN IFNULL(total, 0);
END //

DELIMITER ;


-- ==============================================================================
-- PHASE 3E: TRIGGERS
-- ==============================================================================

DELIMITER //

-- When ambulance dispatch is completed, free the ambulance
CREATE TRIGGER trg_ambulance_completed
AFTER UPDATE ON dispatch_ambulances
FOR EACH ROW
BEGIN
    IF NEW.status = 'COMPLETED' AND OLD.status != 'COMPLETED' THEN
        UPDATE ambulances
        SET status = 'AVAILABLE'
        WHERE ambulance_id = NEW.ambulance_id;
    END IF;
END //

-- When team dispatch is completed/recalled, free the team
CREATE TRIGGER trg_team_completed
AFTER UPDATE ON dispatch_teams
FOR EACH ROW
BEGIN
    IF NEW.status IN ('COMPLETED', 'RECALLED') AND OLD.status = 'DEPLOYED' THEN
        UPDATE rescue_teams
        SET status = 'AVAILABLE'
        WHERE team_id = NEW.team_id;
    END IF;
END //

-- When a victim is unassigned from hospital, free a bed
CREATE TRIGGER trg_victim_discharge
AFTER UPDATE ON victims
FOR EACH ROW
BEGIN
    IF OLD.hospital_id IS NOT NULL AND NEW.hospital_id IS NULL THEN
        UPDATE hospitals
        SET available_beds = available_beds + 1
        WHERE hospital_id = OLD.hospital_id;
    END IF;
END //

-- Auto-alert when blood stock drops below 10
CREATE TRIGGER trg_blood_low_stock
AFTER UPDATE ON blood_stock
FOR EACH ROW
BEGIN
    IF NEW.units_available < 10 AND OLD.units_available >= 10 THEN
        INSERT INTO alerts (incident_id, alert_level, message)
        VALUES (NULL, 'HIGH', CONCAT('LOW BLOOD STOCK: ', NEW.blood_group, ' has only ', NEW.units_available, ' units left'));
    END IF;
END //

-- When incident is resolved, set resolved_time
CREATE TRIGGER trg_incident_resolved
BEFORE UPDATE ON incidents
FOR EACH ROW
BEGIN
    IF NEW.status = 'RESOLVED' AND OLD.status != 'RESOLVED' THEN
        SET NEW.resolved_time = NOW();
    END IF;
END //

DELIMITER ;


-- ==============================================================================
-- PHASE 3F: CURSOR EXAMPLE (Generate daily summary into alerts)
-- ==============================================================================

DELIMITER //

CREATE PROCEDURE sp_daily_incident_summary()
BEGIN
    DECLARE done INT DEFAULT FALSE;
    DECLARE v_type VARCHAR(20);
    DECLARE v_count INT;
    DECLARE v_msg VARCHAR(255);

    DECLARE cur CURSOR FOR
        SELECT incident_type, COUNT(*) AS cnt
        FROM incidents
        WHERE reported_time >= NOW() - INTERVAL 24 HOUR
        GROUP BY incident_type;

    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;

    OPEN cur;

    read_loop: LOOP
        FETCH cur INTO v_type, v_count;
        IF done THEN
            LEAVE read_loop;
        END IF;

        SET v_msg = CONCAT('24H SUMMARY: ', v_count, ' ', v_type, ' incident(s) reported');
        INSERT INTO alerts (incident_id, alert_level, message)
        VALUES (NULL, 'INFO', v_msg);
    END LOOP;

    CLOSE cur;

    SELECT 'Daily summary alerts generated' AS message;
END //

DELIMITER ;


-- ==============================================================================
-- PHASE 3G: USEFUL ANALYTICAL QUERIES (for viva / demo)
-- ==============================================================================

-- These are not stored; run manually when needed for demonstration:

-- 1. JOIN: Incidents with victim counts and ambulance counts
-- SELECT i.incident_id, i.title, i.severity,
--        COUNT(DISTINCT v.victim_id) AS victims,
--        COUNT(DISTINCT da.ambulance_id) AS ambulances
-- FROM incidents i
-- LEFT JOIN victims v ON v.incident_id = i.incident_id
-- LEFT JOIN dispatch_ambulances da ON da.incident_id = i.incident_id
-- GROUP BY i.incident_id, i.title, i.severity;

-- 2. SUBQUERY: Hospitals with below-average available beds
-- SELECT name, available_beds FROM hospitals
-- WHERE available_beds < (SELECT AVG(available_beds) FROM hospitals);

-- 3. AGGREGATE + HAVING: Blood groups critically low
-- SELECT blood_group, units_available FROM blood_stock
-- HAVING units_available < 15;

-- 4. Multi-join response time report
-- SELECT * FROM view_recent_responses;