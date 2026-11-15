# 🚨 SENTINEL: Smart Disaster Response & Emergency Resource Management System

![Project Status](https://img.shields.io/badge/Status-Completed-success)
![Python](https://img.shields.io/badge/Python-3.8+-blue.svg)
![Flask](https://img.shields.io/badge/Flask-RESTful-lightgrey.svg)
![MySQL](https://img.shields.io/badge/MySQL-8.0-orange.svg)
![Leaflet](https://img.shields.io/badge/Leaflet.js-Maps-brightgreen.svg)

**SENTINEL** is a comprehensive Emergency Operations Center (EOC) software solution designed as a **Database Management Systems (DBMS)** academic project. It coordinates disaster response efforts, tracks victim triage, dispatches emergency fleets, manages hospital bed capacity, and monitors critical medical inventories in real-time.

---

## 📑 Table of Contents

- [Features](#-features)
- [System Architecture](#-system-architecture)
- [Technology Stack](#-technology-stack)
- [Database Highlights](#-database-highlights)
- [Installation & Setup](#-installation--setup)
- [Testing](#-testing)
- [Screenshots](#-screenshots)
- [Academic Disclaimer](#-academic-disclaimer)

---

## ✨ Features

- **Interactive Tactical Map:** Real-time visualization of incidents using Leaflet.js and OpenStreetMap. Features auto-geocoding (converts plain text addresses to Lat/Lng coordinates) and glowing threat-level rings.
- **Automated Triage & Hospital Management:** When a victim is admitted to a hospital, MySQL triggers automatically deduct available beds and update occupancy rates.
- **Fleet Dispatch System:** Dispatch and recall modules for Ambulances (ALS/BLS) and Specialized Rescue Teams.
- **Resource & Blood Bank Tracking:** Manage and allocate medical resources (Trauma kits, Hazmat suits) and live blood stock reserves.
- **Single Page Application (SPA):** High-performance frontend with dynamic routing, meaning no page reloads during critical emergency operations.
- **Audit & Telemetry:** Automated tracking of response times and system events for post-incident reporting.

---

## 🏗 System Architecture

SENTINEL follows a modern **3-Tier Architecture**:

1. **Presentation Layer:** Vanilla JavaScript SPA with custom dark-tactical CSS.
2. **Application Layer:** Python Flask serving stateless RESTful JSON APIs.
3. **Data Layer:** MySQL relational database utilizing Stored Procedures, Triggers, and Views.

---

## 💻 Technology Stack

- **Frontend:** HTML5, CSS3 (Custom Variables/Grid), Vanilla JavaScript (ES6+), Leaflet.js
- **Backend:** Python, Flask, Flask-CORS
- **Database:** MySQL (mysql-connector-python), Connection Pooling
- **External APIs:** OpenStreetMap Nominatim (Free Geocoding)

---

## 🗄 Database Highlights

To achieve maximum data integrity and demonstrate advanced DBMS concepts, the backend relies heavily on database-side business logic:

- **Stored Procedures:** Used for complex transactional operations like `sp_register_incident` and `sp_allocate_resource`.
- **Triggers:** `trg_after_victim_admit` prevents race conditions by automatically adjusting hospital bed counts at the exact moment a victim's record is updated.
- **Views:** Real-time data aggregation via `v_active_incidents_summary` and `v_hospital_occupancy`.
- **Constraints:** Strict `ENUM` domains, `CHECK` constraints (preventing negative inventory), and `ON DELETE CASCADE` relationships.

---

## 🚀 Installation & Setup

### Prerequisites

- Python 3.8 or higher
- MySQL Server 8.0+

### 1. Database Setup

1. Open your MySQL client (e.g., MySQL Workbench).
2. Execute the provided schema file located at `database/schema.sql`.
3. This will create the `disaster_response` database, tables, triggers, and populate it with realistic seed data.

### 2. Application Setup

Clone the repository and install the required Python dependencies:

```bash
# Clone the repository
git clone https://github.com/yourusername/SENTINEL.git
cd SENTINEL

# Create a virtual environment (optional but recommended)
python -m venv venv
source venv/bin/activate  # On Windows use: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### 3. Environment Configuration

Create a `.env` file in the root directory (or edit `backend/config.py`) with your MySQL credentials:

```env
MYSQL_HOST=localhost
MYSQL_USER=root
MYSQL_PASSWORD=your_mysql_password
MYSQL_DB=disaster_response
```

### 4. Run the Server

```bash
python run.py
```

The application will be live at: <http://127.0.0.1:5000/>

---

## 🧪 Testing

The project includes an automated end-to-end integration test suite that verifies API endpoints, database procedural triggers, and fallback logic.

To run the test suite:

```bash
python -m unittest tests/test_system.py
```

---

## 📸 Screenshots

<!-- Take screenshots of your running application, save them in a docs/ folder, then link them here. -->

**Command Dashboard & Tactical Map**

![Dashboard](docs/dashboard.png)

**Hospital Capacity Management**

![Hospitals](docs/hospitals.png)

**Ambulance Fleet Dispatch**

![Fleet](docs/fleet.png)

---

## 🎓 Academic Disclaimer

This project was developed as a requirement for a Database Management Systems (DBMS) academic curriculum. It demonstrates the practical implementation of relational database design, REST API integration, and front-end state management.

**Developed by:** Pari Mittal
**Institution:** Jaypee Institute of Information Technology 
**Year:** 2026