/**
 * SENTINEL — Emergency Command Interface
 * Full SPA Controller (Dashboard + Module Navigation + Modals)
 */

let dashboardHtmlCache = '';
let sentinelMap = null;
let mapMarkersLayer = null;

document.addEventListener('DOMContentLoaded', function () {
    console.log('[SENTINEL] Command Interface initialized.');
    
    // Cache original dashboard HTML layout from index.html
    const contentEl = document.querySelector('.content');
    if (contentEl) dashboardHtmlCache = contentEl.innerHTML;

    initClock();
    initSidebarToggle();
    initNavigation();
    checkDatabaseLink();
    loadDashboard();

    setInterval(checkDatabaseLink, 30000);
    setInterval(function() {
        const activeNav = document.querySelector('.nav-item.active');
        if (activeNav && activeNav.dataset.page === 'dashboard') {
            loadDashboard();
        }
    }, 60000);
});

/* ===================== CLOCK ===================== */
function initClock() {
    const timeEl = document.getElementById('clock-time');
    const dateEl = document.getElementById('clock-date');
    const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];

    function tick() {
        const now = new Date();
        const hh = String(now.getHours()).padStart(2, '0');
        const mm = String(now.getMinutes()).padStart(2, '0');
        const ss = String(now.getSeconds()).padStart(2, '0');
        if (timeEl) timeEl.textContent = hh + ':' + mm + ':' + ss;
        if (dateEl) {
            dateEl.textContent = days[now.getDay()] + ' · ' +
                months[now.getMonth()] + ' ' +
                String(now.getDate()).padStart(2, '0');
        }
    }
    tick();
    setInterval(tick, 1000);
}


/* ===================== SIDEBAR & SPA NAV ===================== */
function initSidebarToggle() {
    const btn = document.getElementById('sb-toggle');
    const sb = document.getElementById('sidebar');
    if (!btn || !sb) return;
    btn.addEventListener('click', function () {
        sb.classList.toggle('open');
    });
    sb.querySelectorAll('.nav-item').forEach(function (item) {
        item.addEventListener('click', function () {
            if (window.innerWidth <= 768) sb.classList.remove('open');
        });
    });
}


function initNavigation() {
    const items = document.querySelectorAll('.nav-item');
    const pageTitle = document.getElementById('page-title');

    items.forEach(function (item) {
        item.addEventListener('click', function (e) {
            e.preventDefault();
            items.forEach(function (i) { i.classList.remove('active'); });
            this.classList.add('active');
            
            const page = this.dataset.page;
            const labelNode = this.querySelector('span:nth-of-type(2)');
            const label = labelNode ? labelNode.textContent : page;
            if (pageTitle) pageTitle.textContent = label.toUpperCase();

            routePage(page);
        });
    });

    document.addEventListener('click', function (e) {
        const link = e.target.closest('.panel-link');
        if (link) {
            e.preventDefault();
            const target = link.dataset.page;
            const navLink = document.querySelector('.nav-item[data-page="' + target + '"]');
            if (navLink) navLink.click();
        }
    });
}

function routePage(page) {
    const content = document.querySelector('.content');
    if (!content) return;

    if (page === 'dashboard') {
        content.innerHTML = dashboardHtmlCache;
        loadDashboard();
        return;
    }

    content.innerHTML = '<div style="padding: 2rem; color: var(--cyan); font-family: var(--mono); letter-spacing: 2px;">FETCHING TELEMETRY [' + page.toUpperCase() + ']...</div>';

    switch (page) {
        case 'incidents': loadIncidentsView(); break;
        case 'victims': loadVictimsView(); break;
        case 'ambulances': loadAmbulancesView(); break;
        case 'rescue-teams': loadTeamsView(); break;
        case 'hospitals': loadHospitalsView(); break;
        case 'resources': loadResourcesView(); break;
        case 'blood': loadBloodView(); break;
        case 'responses': loadResponsesView(); break;
        case 'reports': loadReportsView(); break;
        case 'requests': loadRequestsView(); break;
        default: loadPlaceholderView(page); break;
    }
}


/* ===================== DB LINK ===================== */
function checkDatabaseLink() {
    const dot = document.getElementById('db-link-dot');
    const value = document.getElementById('db-link-value');

    fetch('/api/health')
        .then(function (r) { return r.json(); })
        .then(function (data) {
            const ok = data.database && data.database.status === 'success';
            if (dot) dot.className = 'status-indicator ' + (ok ? 'ok' : 'err');
            if (value) value.textContent = ok ? 'ONLINE' : 'OFFLINE';
        })
        .catch(function () {
            if (dot) dot.className = 'status-indicator err';
            if (value) value.textContent = 'OFFLINE';
        });
}

/* ===================== HELPERS ===================== */
function esc(text) {
    if (text === null || text === undefined) return '';
    var d = document.createElement('div');
    d.appendChild(document.createTextNode(String(text)));
    return d.innerHTML;
}

function fmtTime(dt) {
    if (!dt) return '—';
    return String(dt).replace('T', ' ').substring(0, 19);
}

function timeAgo(dt) {
    if (!dt) return '';
    var t = new Date(String(dt).replace(' ', 'T'));
    if (isNaN(t.getTime())) return '';
    var mins = Math.floor((Date.now() - t.getTime()) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return mins + ' min ago';
    var hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs + 'h ago';
    return Math.floor(hrs / 24) + 'd ago';
}

function openModal(title, bodyHtml, onConfirm) {
    let root = document.getElementById('modal-root');
    if (!root) {
        root = document.createElement('div');
        root.id = 'modal-root';
        document.body.appendChild(root);
    }
    root.className = 'modal-overlay';
    root.innerHTML = `
        <div class="modal-box">
            <div class="modal-header">
                <h3>${esc(title)}</h3>
                <button class="modal-close" data-close>✕</button>
            </div>
            <div class="modal-body">${bodyHtml}</div>
            <div class="modal-footer">
                <button class="btn-ghost" data-close>CANCEL</button>
                <button class="btn-cyan" data-save>CONFIRM ACTION</button>
            </div>
        </div>
    `;

    const close = () => { root.className = 'modal-overlay hidden'; };
    root.onclick = (e) => { if (e.target === root) close(); };
    root.querySelectorAll('[data-close]').forEach(b => b.onclick = close);
    root.querySelector('[data-save]').onclick = async () => {
        try {
            await onConfirm(root);
            close();
        } catch (err) {
            alert(err.message || String(err));
        }
    };
}

/* ===================== DASHBOARD LOADER ===================== */
function loadDashboard() {
    loadStats();
    loadAlerts();
    loadRecentIncidents();
    loadRecentResponses();

    setTimeout(() => {
        initTacticalMap();
        loadMapIncidents();
    }, 150);
}

function loadStats() {
    fetch('/api/dashboard/stats')
        .then(function (r) { return r.json(); })
        .then(function (res) {
            if (res.status !== 'success') return;
            var s = res.stats || {};
            var sev = res.severity || {};
            var fleet = res.fleet || {};
            var beds = res.beds || {};
            var blood = res.blood || [];

            setText('s-incidents', s.active_incidents);
            setText('s-incidents-meta', (sev.CRITICAL || 0) + ' critical · ' + (sev.HIGH || 0) + ' high');
            setText('s-victims', s.total_victims);
            setText('s-victims-meta', 'registered in system');
            setText('s-ambulances', s.available_ambulances);
            setText('s-ambulances-meta', (fleet.DISPATCHED || 0) + ' dispatched · ' + (fleet.MAINTENANCE || 0) + ' OOS');
            setText('s-teams', s.deployed_teams);
            setText('s-teams-meta', 'currently deployed');
            setText('s-beds', s.available_beds);
            setText('s-beds-meta', (beds.occupied || 0) + ' occupied / ' + (beds.total || 0) + ' total');
            setText('s-alerts', s.recent_alerts);
            setText('s-alerts-meta', 'last 24 hours');

            setText('nav-badge-incidents', s.active_incidents);

            var totalSev = (sev.CRITICAL || 0) + (sev.HIGH || 0) + (sev.MODERATE || 0) + (sev.LOW || 0);
            totalSev = totalSev || 1;
            setSev('critical', sev.CRITICAL || 0, totalSev);
            setSev('high', sev.HIGH || 0, totalSev);
            setSev('moderate', sev.MODERATE || 0, totalSev);
            setSev('low', sev.LOW || 0, totalSev);

            setText('fleet-available', fleet.AVAILABLE || 0);
            setText('fleet-dispatched', fleet.DISPATCHED || 0);
            setText('fleet-oos', fleet.MAINTENANCE || 0);
            var fleetTotal = (fleet.AVAILABLE || 0) + (fleet.DISPATCHED || 0) + (fleet.MAINTENANCE || 0);
            var fleetOps = (fleet.AVAILABLE || 0) + (fleet.DISPATCHED || 0);
            var fleetPct = fleetTotal ? Math.round((fleetOps / fleetTotal) * 100) : 0;
            var fleetBar = document.getElementById('fleet-bar');
            if (fleetBar) fleetBar.style.width = fleetPct + '%';
            setText('fleet-ratio', fleetOps + ' / ' + fleetTotal + ' units operational');

            setText('bed-available', beds.available || 0);
            setText('bed-occupied', beds.occupied || 0);
            setText('bed-total', beds.total || 0);
            var bedPct = beds.total ? Math.round((beds.occupied / beds.total) * 100) : 0;
            var bedBar = document.getElementById('bed-bar');
            if (bedBar) bedBar.style.width = bedPct + '%';
            setText('bed-ratio', bedPct + '% capacity used');

            var bg = document.getElementById('blood-grid');
            if (bg && blood.length) {
                bg.innerHTML = blood.map(function (b) {
                    return '<div class="blood-cell">' +
                        '<span class="bc-type">' + esc(b.blood_group) + '</span>' +
                        '<span class="bc-qty">' + esc(b.units_available) + '</span>' +
                        '</div>';
                }).join('');
            }

            setText('mf-incidents', s.active_incidents);
            setText('mf-units', fleet.DISPATCHED || 0);
            setText('mf-sync', new Date().toLocaleTimeString());
        })
        .catch(function (e) { console.error('[SENTINEL] stats error', e); });
}

function setText(id, val) {
    var el = document.getElementById(id);
    if (el) el.textContent = (val === null || val === undefined) ? '—' : val;
}

function setSev(key, count, total) {
    setText('sev-' + key, count);
    var map = { critical: 'crit', high: 'high', moderate: 'mod', low: 'low' };
    var fill = document.querySelector('.sev-fill.' + map[key]);
    if (fill) fill.style.width = Math.round((count / total) * 100) + '%';
}

function loadAlerts() {
    fetch('/api/dashboard/alerts')
        .then(function (r) { return r.json(); })
        .then(function (res) {
            var feed = document.getElementById('alert-feed');
            var countPill = document.getElementById('alerts-count');
            if (!feed) return;
            var data = res.data || [];
            if (countPill) countPill.textContent = data.length;
            if (!data.length) {
                feed.innerHTML = '<div class="feed-empty"><span>⌁</span><p>NO ALERTS IN FEED</p></div>';
                return;
            }
            feed.innerHTML = data.map(function (a) {
                var lvl = (a.alert_level || 'INFO').toLowerCase();
                var t = fmtTime(a.alert_time);
                var timeShort = t.length >= 16 ? t.substring(11, 16) : t;
                return '<div class="alert-row ' + lvl + '">' +
                    '<div class="alert-time-tag">' +
                    '<span class="alert-time">' + esc(timeShort) + '</span>' +
                    '<span class="alert-level ' + lvl + '">' + esc(a.alert_level) + '</span>' +
                    '</div>' +
                    '<div class="alert-msg">' + esc(a.message) + '</div>' +
                    '</div>';
            }).join('');
        })
        .catch(function (e) { console.error('[SENTINEL] alerts error', e); });
}


function loadRecentIncidents() {
    fetch('/api/dashboard/recent-incidents')
        .then(function (r) { return r.json(); })
        .then(function (res) {
            var body = document.getElementById('recent-incidents-body');
            if (!body) return;
            var data = res.data || [];
            if (!data.length) {
                body.innerHTML = '<tr class="empty-row"><td colspan="6">NO INCIDENT RECORDS</td></tr>';
                return;
            }
            body.innerHTML = data.map(function (i) {
                var sev = (i.severity || '').toUpperCase();
                var dot = sev === 'CRITICAL' ? 'red' : sev === 'HIGH' ? 'orange' : sev === 'MODERATE' ? 'yellow' : 'green';
                var st = (i.status || '').toUpperCase();
                var stClass = st === 'ACTIVE' ? 'status-active' : 'status-contained';
                return '<tr>' +
                    '<td class="row-id">INC-' + esc(i.incident_id) + '</td>' +
                    '<td>' + esc(i.incident_type) + '</td>' +
                    '<td>' + esc(i.location_desc) + '</td>' +
                    '<td><span class="sev-dot ' + dot + '"></span></td>' +
                    '<td class="' + stClass + '">' + esc(st) + '</td>' +
                    '<td>' + esc(timeAgo(i.reported_time)) + '</td>' +
                    '</tr>';
            }).join('');
        })
        .catch(function (e) { console.error('[SENTINEL] incidents error', e); });
}

function loadRecentResponses() {
    fetch('/api/dashboard/recent-responses')
        .then(function (r) { return r.json(); })
        .then(function (res) {
            var body = document.getElementById('recent-responses-body');
            if (!body) return;
            var data = res.data || [];
            if (!data.length) {
                body.innerHTML = '<tr class="empty-row"><td colspan="4">NO RESPONSE RECORDS</td></tr>';
                return;
            }
            body.innerHTML = data.map(function (r) {
                var mins = r.response_minutes != null ? r.response_minutes + ' min' : '—';
                return '<tr>' +
                    '<td class="row-id">R-' + esc(r.resp_id) + '</td>' +
                    '<td>INC-' + esc(r.incident_id) + '</td>' +
                    '<td>' + esc(r.unit) + '</td>' +
                    '<td>' + esc(mins) + '</td>' +
                    '</tr>';
            }).join('');
        })
        .catch(function (e) { console.error('[SENTINEL] responses error', e); });
}

function initTacticalMap() {
    const mapContainer = document.getElementById('tactical-map');
    if (!mapContainer) return;

    if (sentinelMap !== null) {
        try { sentinelMap.remove(); } catch (e) {}
        sentinelMap = null;
    }

    sentinelMap = L.map('tactical-map', {
        zoomControl: false,
        attributionControl: false
    }).setView([28.5355, 77.3910], 11);

    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 16
    }).addTo(sentinelMap);

    L.control.zoom({ position: 'bottomright' }).addTo(sentinelMap);
    mapMarkersLayer = L.layerGroup().addTo(sentinelMap);

    setTimeout(function () {
        if (sentinelMap) {
            sentinelMap.invalidateSize();
            loadMapIncidents();
        }
    }, 200);
}

function loadMapIncidents() {
    if (!sentinelMap || !mapMarkersLayer) return;

    fetch('/api/dashboard/map-incidents')
        .then(function (r) { return r.json(); })
        .then(function (res) {
            // Unify response format whether backend returns res or res.data
            var data = res.data || res || [];
            if (!Array.isArray(data)) data = [];

            mapMarkersLayer.clearLayers();
            var bounds = [];

            data.forEach(function (inc) {
                var lat = parseFloat(inc.latitude);
                var lng = parseFloat(inc.longitude);

                // Skip pins with no real coordinates (do NOT invent Noida)
                if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) {
                    return;
                }

                var pos = [lat, lng];
                bounds.push(pos);

                var sev = String(inc.severity || 'LOW').toUpperCase();
                var markerClass =
                    sev === 'CRITICAL' ? 'marker-crit' :
                    sev === 'HIGH'     ? 'marker-high' :
                    sev === 'MODERATE' ? 'marker-mod'  : 'marker-low';

                var type = String(inc.incident_type || '').toUpperCase();
                var iconChar = '⚠';
                if (type.indexOf('FIRE') >= 0) iconChar = '🔥';
                else if (type.indexOf('FLOOD') >= 0) iconChar = '🌊';
                else if (type.indexOf('HAZMAT') >= 0) iconChar = '☣';
                else if (type.indexOf('ACCIDENT') >= 0) iconChar = '💥';

                // Create custom high-visibility DivIcon
                var customIcon = L.divIcon({
                    className: 'tactical-marker ' + markerClass,
                    html: '<span>' + iconChar + '</span>',
                    iconSize: [32, 32],
                    iconAnchor: [16, 16],
                    popupAnchor: [0, -18]
                });

                var popupHtml =
                    '<div style="font-family: var(--mono, monospace); min-width: 180px;">' +
                      '<div style="color: #00f0ff; font-weight:bold; border-bottom: 1px solid rgba(0,240,255,0.3); padding-bottom:4px; margin-bottom:6px;">' +
                        'INC-' + esc(inc.incident_id || inc.id || '—') + ' // ' + esc(inc.incident_type || 'EVENT') +
                      '</div>' +
                      '<div style="font-size: 0.85rem; margin-bottom: 4px; color:#fff; font-weight:bold;">' + esc(inc.title || inc.location_desc || 'Untitled') + '</div>' +
                      '<div style="font-size: 0.75rem; color: #8a99ad;">LOCATION: <strong style="color:#fff">' + esc(inc.location_desc || inc.location_name || 'N/A') + '</strong></div>' +
                      '<div style="font-size: 0.75rem; color: #8a99ad;">SEVERITY: <strong style="color:#00f0ff">' + esc(sev) + '</strong></div>' +
                      '<div style="font-size: 0.75rem; color: #8a99ad;">STATUS: <strong style="' + (inc.status === 'ACTIVE' ? 'color:#ff3366' : 'color:#00cc66') + '">' + esc(inc.status || 'UNKNOWN') + '</strong></div>' +
                    '</div>';

                L.marker(pos, { icon: customIcon })
                    .bindPopup(popupHtml)
                    .addTo(mapMarkersLayer);
            });

            // Adjust view to show all markers
            if (bounds.length > 0) {
                var latLngBounds = L.latLngBounds(bounds);
                sentinelMap.fitBounds(latLngBounds, { padding: [50, 50], maxZoom: 13 });
            }

            // Force Leaflet to refresh rendering layer
            sentinelMap.invalidateSize();
        })
        .catch(function (e) {
            console.error('[SENTINEL] Map load error:', e);
        });
}

function hexRgba(hex, alpha) {
    hex = hex.replace('#', '');
    var r = parseInt(hex.substring(0, 2), 16);
    var g = parseInt(hex.substring(2, 4), 16);
    var b = parseInt(hex.substring(4, 6), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
}

/* ===================== MODULE VIEWS & MODALS ===================== */

/* 1. Incidents Module */
function loadIncidentsView() {
    fetch('/api/incidents')
        .then(r => r.json())
        .then(res => {
            const data = res.data || [];
            const content = document.querySelector('.content');
            content.innerHTML = `
                <div class="module-toolbar">
                    <span class="toolbar-title">INCIDENT DIRECTORY [${data.length}]</span>
                    <button class="btn-cyan" id="btn-open-register-inc">+ REGISTER INCIDENT</button>
                </div>
                <div class="panel">
                    <div class="table-wrap">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>ID</th><th>TITLE</th><th>TYPE</th><th>SEVERITY</th><th>LOCATION</th><th>VICTIMS</th><th>STATUS</th><th>REPORTED</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${data.length ? data.map(i => `
                                    <tr>
                                        <td class="row-id">INC-${esc(i.incident_id)}</td>
                                        <td><strong>${esc(i.title)}</strong></td>
                                        <td>${esc(i.incident_type)}</td>
                                        <td><span class="sev-tag ${esc((i.severity||'').toLowerCase())}">${esc(i.severity)}</span></td>
                                        <td>${esc(i.location_desc)}</td>
                                        <td>${esc(i.victim_count || 0)}</td>
                                        <td><span class="${i.status === 'ACTIVE' ? 'status-active' : 'status-contained'}">${esc(i.status)}</span></td>
                                        <td>${esc(fmtTime(i.reported_time))}</td>
                                    </tr>
                                `).join('') : '<tr class="empty-row"><td colspan="8">NO INCIDENTS REGISTERED</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;

            document.getElementById('btn-open-register-inc').onclick = openRegisterIncidentModal;
        });
}

        async (root) => {
            let lat = root.querySelector('#f-inc-lat').value.trim();
            let lng = root.querySelector('#f-inc-lng').value.trim();
            let locationDesc = root.querySelector('#f-inc-loc').value.trim();

            // SMART GEOCODING — bias to India, try multiple query shapes
            if ((!lat || !lng) && locationDesc) {
                const tryQueries = [
                    locationDesc + ', India',
                    locationDesc,
                    // If user typed a state/city keyword, query state center
                    locationDesc.split(',')[0].trim() + ', India'
                ];

                for (const q of tryQueries) {
                    try {
                        const geoRes = await fetch(
                            'https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=in&q=' +
                            encodeURIComponent(q),
                            { headers: { 'Accept-Language': 'en', 'User-Agent': 'SENTINEL-Emergency-System/1.0' } }
                        ).then(r => r.json());

                        if (geoRes && geoRes.length > 0) {
                            lat = geoRes[0].lat;
                            lng = geoRes[0].lon;
                            console.log('[SENTINEL] Geocoded', q, '→', lat, lng, geoRes[0].display_name);
                            break;
                        }
                    } catch (e) {
                        console.log('Geocode attempt failed for', q);
                    }
                }
            }

            // Last-resort: known Indian state/city centroids (so Assam never becomes Noida)
            if ((!lat || !lng) && locationDesc) {
                const key = locationDesc.toLowerCase();
                const centroids = {
                    'assam': [26.2006, 92.9376],
                    'guwahati': [26.1445, 91.7362],
                    'bihar': [25.0961, 85.3131],
                    'patna': [25.5941, 85.1376],
                    'west bengal': [22.9868, 87.8550],
                    'kolkata': [22.5726, 88.3639],
                    'odisha': [20.9517, 85.0985],
                    'odisha': [20.9517, 85.0985],
                    'orissa': [20.9517, 85.0985],
                    'kerala': [10.8505, 76.2711],
                    'tamil nadu': [11.1271, 78.6569],
                    'chennai': [13.0827, 80.2707],
                    'maharashtra': [19.7515, 75.7139],
                    'mumbai': [19.0760, 72.8777],
                    'delhi': [28.6139, 77.2090],
                    'new delhi': [28.6139, 77.2090],
                    'uttar pradesh': [26.8467, 80.9462],
                    'lucknow': [26.8467, 80.9462],
                    'noida': [28.5355, 77.3910],
                    'dadri': [28.5529, 77.5542],
                    'greater noida': [28.4744, 77.5040],
                    'ghaziabad': [28.6692, 77.4538],
                    'gurugram': [28.4595, 77.0266],
                    'gurgaon': [28.4595, 77.0266],
                    'rajasthan': [27.0238, 74.2179],
                    'jaipur': [26.9124, 75.7873],
                    'gujarat': [22.2587, 71.1924],
                    'ahmedabad': [23.0225, 72.5714],
                    'punjab': [31.1471, 75.3412],
                    'chandigarh': [30.7333, 76.7794],
                    'haryana': [29.0588, 76.0856],
                    'himachal': [31.1048, 77.1734],
                    'uttarakhand': [30.0668, 79.0193],
                    'jharkhand': [23.6102, 85.2799],
                    'chhattisgarh': [21.2787, 81.8661],
                    'madhya pradesh': [22.9734, 78.6569],
                    'telangana': [18.1124, 79.0193],
                    'hyderabad': [17.3850, 78.4867],
                    'andhra pradesh': [15.9129, 79.7400],
                    'karnataka': [15.3173, 75.7139],
                    'bengaluru': [12.9716, 77.5946],
                    'bangalore': [12.9716, 77.5946],
                    'goa': [15.2993, 74.1240],
                    'sikkim': [27.5330, 88.5122],
                    'meghalaya': [25.4670, 91.3662],
                    'manipur': [24.6637, 93.9063],
                    'mizoram': [23.1645, 92.9376],
                    'nagaland': [26.1584, 94.5624],
                    'tripura': [23.9408, 91.9882],
                    'arunachal': [28.2180, 94.7278],
                    'jammu': [32.7266, 74.8570],
                    'kashmir': [33.7782, 76.5762],
                    'ladakh': [34.1526, 77.5770]
                };
                for (const name in centroids) {
                    if (key.indexOf(name) !== -1) {
                        lat = String(centroids[name][0]);
                        lng = String(centroids[name][1]);
                        console.log('[SENTINEL] Centroid fallback for', name, lat, lng);
                        break;
                    }
                }
            }

            const payload = {
                title: root.querySelector('#f-inc-title').value.trim(),
                incident_type: root.querySelector('#f-inc-type').value,
                severity: root.querySelector('#f-inc-sev').value,
                location_desc: locationDesc,
                latitude: lat || null,
                longitude: lng || null
            };

            if (!payload.title || !payload.location_desc) {
                throw new Error('Title and Location Description are required.');
            }

            // Warn operator if still no coordinates
            if (!payload.latitude || !payload.longitude) {
                console.warn('[SENTINEL] No coordinates resolved for:', locationDesc);
            }

            const res = await fetch('/api/incidents', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            }).then(r => r.json());

            if (res.status !== 'success') throw new Error(res.message || 'Registration failed');
            loadIncidentsView();
            if (typeof loadMapIncidents === 'function') loadMapIncidents();
        }


function openRegisterIncidentModal() {
    openModal(
        'REGISTER NEW INCIDENT',
        `
            <div class="form-grid">
                <div class="full form-group">
                    <label>INCIDENT TITLE</label>
                    <input id="f-inc-title" placeholder="e.g. Major Flooding at Kaziranga" />
                </div>
                <div class="form-group">
                    <label>INCIDENT TYPE</label>
                    <select id="f-inc-type">
                        <option value="FIRE">FIRE</option>
                        <option value="FLOOD">FLOOD</option>
                        <option value="HAZMAT">HAZMAT</option>
                        <option value="MEDICAL">MEDICAL</option>
                        <option value="ACCIDENT">ACCIDENT</option>
                        <option value="OTHER">OTHER</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>SEVERITY</label>
                    <select id="f-inc-sev">
                        <option value="CRITICAL">CRITICAL</option>
                        <option value="HIGH">HIGH</option>
                        <option value="MODERATE" selected>MODERATE</option>
                        <option value="LOW">LOW</option>
                    </select>
                </div>
                <div class="full form-group">
                    <label>LOCATION (City, State)</label>
                    <input id="f-inc-loc" placeholder="e.g. Guwahati, Assam" />
                </div>
                <div class="form-group">
                    <label>LATITUDE (Optional)</label>
                    <input id="f-inc-lat" placeholder="Auto-geocoded if blank" />
                </div>
                <div class="form-group">
                    <label>LONGITUDE (Optional)</label>
                    <input id="f-inc-lng" placeholder="Auto-geocoded if blank" />
                </div>
            </div>
        `,
        async (root) => {
            let lat = root.querySelector('#f-inc-lat').value.trim();
            let lng = root.querySelector('#f-inc-lng').value.trim();
            let locationDesc = root.querySelector('#f-inc-loc').value.trim();

            // SMART GEOCODING — bias to India, try multiple query shapes
            if ((!lat || !lng) && locationDesc) {
                const tryQueries = [
                    locationDesc + ', India',
                    locationDesc,
                    // If user typed a state/city keyword, query state center
                    locationDesc.split(',')[0].trim() + ', India'
                ];

                for (const q of tryQueries) {
                    try {
                        const geoRes = await fetch(
                            'https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=in&q=' +
                            encodeURIComponent(q),
                            { headers: { 'Accept-Language': 'en', 'User-Agent': 'SENTINEL-Emergency-System/1.0' } }
                        ).then(r => r.json());

                        if (geoRes && geoRes.length > 0) {
                            lat = geoRes[0].lat;
                            lng = geoRes[0].lon;
                            console.log('[SENTINEL] Geocoded', q, '→', lat, lng, geoRes[0].display_name);
                            break;
                        }
                    } catch (e) {
                        console.log('Geocode attempt failed for', q);
                    }
                }
            }

            // Last-resort: known Indian state/city centroids (so Assam never becomes Noida)
            if ((!lat || !lng) && locationDesc) {
                const key = locationDesc.toLowerCase();
                const centroids = {
                    'assam': [26.2006, 92.9376], 'guwahati': [26.1445, 91.7362],
                    'bihar': [25.0961, 85.3131], 'patna': [25.5941, 85.1376],
                    'west bengal': [22.9868, 87.8550], 'kolkata': [22.5726, 88.3639],
                    'odisha': [20.9517, 85.0985], 'kerala': [10.8505, 76.2711],
                    'tamil nadu': [11.1271, 78.6569], 'chennai': [13.0827, 80.2707],
                    'maharashtra': [19.7515, 75.7139], 'mumbai': [19.0760, 72.8777],
                    'delhi': [28.6139, 77.2090], 'uttar pradesh': [26.8467, 80.9462],
                    'lucknow': [26.8467, 80.9462], 'noida': [28.5355, 77.3910],
                    'rajasthan': [27.0238, 74.2179], 'jaipur': [26.9124, 75.7873],
                    'gujarat': [22.2587, 71.1924], 'ahmedabad': [23.0225, 72.5714],
                    'punjab': [31.1471, 75.3412], 'haryana': [29.0588, 76.0856],
                    'madhya pradesh': [22.9734, 78.6569], 'telangana': [18.1124, 79.0193],
                    'hyderabad': [17.3850, 78.4867], 'karnataka': [15.3173, 75.7139],
                    'bengaluru': [12.9716, 77.5946], 'jammu': [32.7266, 74.8570]
                };
                for (const name in centroids) {
                    if (key.indexOf(name) !== -1) {
                        lat = String(centroids[name][0]);
                        lng = String(centroids[name][1]);
                        console.log('[SENTINEL] Centroid fallback for', name, lat, lng);
                        break;
                    }
                }
            }

            const payload = {
                title: root.querySelector('#f-inc-title').value.trim(),
                incident_type: root.querySelector('#f-inc-type').value,
                severity: root.querySelector('#f-inc-sev').value,
                location_desc: locationDesc,
                latitude: lat || null,
                longitude: lng || null
            };

            if (!payload.title || !payload.location_desc) {
                throw new Error('Title and Location Description are required.');
            }

            // Warn operator if still no coordinates
            if (!payload.latitude || !payload.longitude) {
                console.warn('[SENTINEL] No coordinates resolved for:', locationDesc);
            }

            const res = await fetch('/api/incidents', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            }).then(r => r.json());

            if (res.status !== 'success') throw new Error(res.message || 'Registration failed');
            
            // 1. Refresh the table view
            loadIncidentsView();
            
            // 2. If the map is currently active in the background, refresh it
            if (sentinelMap && typeof loadMapIncidents === 'function') {
                loadMapIncidents();
            }
        }
    );
}

/* 2. Victims Module */
function loadVictimsView() {
    fetch('/api/victims')
        .then(r => r.json())
        .then(res => {
            const data = res.data || [];
            const content = document.querySelector('.content');
            content.innerHTML = `
                <div class="module-toolbar">
                    <span class="toolbar-title">VICTIM DIRECTORY & TRIAGE [${data.length}]</span>
                    <button class="btn-cyan" id="btn-open-register-victim">+ REGISTER VICTIM</button>
                </div>
                <div class="panel">
                    <div class="table-wrap">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>ID</th><th>NAME</th><th>INCIDENT</th><th>AGE / GENDER</th><th>CONDITION</th><th>HOSPITAL</th><th>ACTION</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${data.length ? data.map(v => `
                                    <tr>
                                        <td class="row-id">VIC-${esc(v.victim_id)}</td>
                                        <td><strong>${esc(v.name || 'UNKNOWN')}</strong></td>
                                        <td>INC-${esc(v.incident_id)} — ${esc(v.incident_title || '')}</td>
                                        <td>${esc(v.age || '—')} / ${esc(v.gender || '—')}</td>
                                        <td><span class="sev-tag ${esc((v.medical_condition || '').toLowerCase())}">${esc(v.medical_condition)}</span></td>
                                        <td>${esc(v.hospital_name || 'UNADMITTED')}</td>
                                        <td>
                                            ${!v.hospital_id ? `<button class="btn-cyan btn-sm" onclick="openAdmitVictimModal(${v.victim_id})">ADMIT</button>` : '<span style="color:var(--green)">ADMITTED</span>'}
                                        </td>
                                    </tr>
                                `).join('') : '<tr class="empty-row"><td colspan="7">NO VICTIM RECORDS</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;

            document.getElementById('btn-open-register-victim').onclick = openRegisterVictimModal;
        });
}

function openRegisterVictimModal() {
    fetch('/api/incidents')
        .then(r => r.json())
        .then(res => {
            const incidents = res.data || [];
            const options = incidents.map(i => `<option value="${i.incident_id}">INC-${i.incident_id} — ${esc(i.title)}</option>`).join('');

            openModal(
                'REGISTER NEW VICTIM',
                `
                    <div class="form-grid">
                        <div class="full form-group">
                            <label>ASSOCIATED INCIDENT</label>
                            <select id="f-vic-inc">${options || '<option value="">No Active Incidents</option>'}</select>
                        </div>
                        <div class="full form-group">
                            <label>VICTIM NAME</label>
                            <input id="f-vic-name" placeholder="Full name or UNKNOWN" />
                        </div>
                        <div class="form-group">
                            <label>AGE</label>
                            <input id="f-vic-age" type="number" placeholder="Age" />
                        </div>
                        <div class="form-group">
                            <label>GENDER</label>
                            <select id="f-vic-gender">
                                <option>UNKNOWN</option>
                                <option>MALE</option>
                                <option>FEMALE</option>
                                <option>OTHER</option>
                            </select>
                        </div>
                        <div class="full form-group">
                            <label>MEDICAL CONDITION / TRIAGE</label>
                            <select id="f-vic-cond">
                                <option>CRITICAL</option>
                                <option>SERIOUS</option>
                                <option>STABLE</option>
                                <option>MINOR</option>
                            </select>
                        </div>
                    </div>
                `,
                async (root) => {
                    const payload = {
                        incident_id: Number(root.querySelector('#f-vic-inc').value),
                        name: root.querySelector('#f-vic-name').value.trim() || 'UNKNOWN',
                        age: root.querySelector('#f-vic-age').value ? Number(root.querySelector('#f-vic-age').value) : null,
                        gender: root.querySelector('#f-vic-gender').value,
                        medical_condition: root.querySelector('#f-vic-cond').value
                    };
                    if (!payload.incident_id) throw new Error('Incident required');

                    const res = await fetch('/api/victims', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    }).then(r => r.json());

                    if (res.status !== 'success') throw new Error(res.message || 'Registration failed');
                    loadVictimsView();
                }
            );
        });
}

function openAdmitVictimModal(victimId) {
    fetch('/api/hospitals')
        .then(r => r.json())
        .then(res => {
            const hospitals = res.data || [];
            const options = hospitals.map(h => `<option value="${h.hospital_id}">${esc(h.name)} (${h.available_beds} beds free)</option>`).join('');

            openModal(
                `ADMIT VICTIM VIC-${victimId}`,
                `
                    <div class="form-group">
                        <label>SELECT DESTINATION HOSPITAL</label>
                        <select id="f-admit-hosp">${options}</select>
                    </div>
                `,
                async (root) => {
                    const hospitalId = Number(root.querySelector('#f-admit-hosp').value);
                    if (!hospitalId) throw new Error('Hospital required');

                    const res = await fetch(`/api/victims/${victimId}/admit`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ hospital_id: hospitalId })
                    }).then(r => r.json());

                    if (res.status !== 'success') throw new Error(res.message || 'Admission failed');
                    loadVictimsView();
                }
            );
        });
}

/* 3. Ambulances Module */
/* 3. Ambulances Module */
function loadAmbulancesView() {
    fetch('/api/ambulances')
        .then(r => r.json())
        .then(res => {
            const data = res.data || [];
            const content = document.querySelector('.content');
            content.innerHTML = `
                <div class="module-toolbar">
                    <span class="toolbar-title">AMBULANCE FLEET [${data.length}]</span>
                    <button class="btn-cyan" id="btn-add-ambulance">+ ADD AMBULANCE</button>
                </div>
                <div class="panel">
                    <div class="table-wrap">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>ID</th><th>VEHICLE NUMBER</th><th>TYPE</th><th>STATUS</th><th>LOCATION</th><th>ACTION</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${data.length ? data.map(a => {
                                    const st = (a.status || '').toUpperCase();
                                    let action = '—';
                                    if (st === 'AVAILABLE') {
                                        action = `<button class="btn-cyan btn-sm" onclick="openDispatchAmbulanceModal(${a.ambulance_id})">DISPATCH</button>`;
                                    } else if (st === 'DISPATCHED' || st === 'EN_ROUTE' || st === 'ON_SCENE') {
                                        action = `<button class="btn-ghost btn-sm" onclick="recallAmbulance(${a.ambulance_id})">RECALL</button>`;
                                    }
                                    return `
                                    <tr>
                                        <td class="row-id">AMB-${esc(a.ambulance_id)}</td>
                                        <td><strong>${esc(a.vehicle_number)}</strong></td>
                                        <td>${esc(a.type || a.ambulance_type || '—')}</td>
                                        <td><span class="sev-tag ${st === 'AVAILABLE' ? 'low' : st === 'DISPATCHED' ? 'high' : 'critical'}">${esc(st)}</span></td>
                                        <td>${esc(a.current_location || 'Base Station')}</td>
                                        <td>${action}</td>
                                    </tr>`;
                                }).join('') : '<tr class="empty-row"><td colspan="6">NO AMBULANCES FOUND</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
            document.getElementById('btn-add-ambulance').onclick = openAddAmbulanceModal;
        });
}

function openAddAmbulanceModal() {
    openModal(
        'REGISTER NEW AMBULANCE UNIT',
        `
            <div class="form-grid">
                <div class="full form-group">
                    <label>VEHICLE NUMBER</label>
                    <input id="f-amb-num" placeholder="e.g. AMB-109" />
                </div>
                <div class="form-group">
                    <label>TYPE</label>
                    <select id="f-amb-type">
                        <option value="ALS">ALS</option>
                        <option value="BLS">BLS</option>
                        <option value="NEONATAL">NEONATAL</option>
                        <option value="PATIENT TRANSPORT">PATIENT TRANSPORT</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>BASE LOCATION</label>
                    <input id="f-amb-loc" placeholder="Station Alpha" value="Base Station" />
                </div>
            </div>
        `,
        async (root) => {
            const payload = {
                vehicle_number: root.querySelector('#f-amb-num').value.trim(),
                type: root.querySelector('#f-amb-type').value,
                current_location: root.querySelector('#f-amb-loc').value.trim() || 'Base Station'
            };
            if (!payload.vehicle_number) throw new Error('Vehicle number required');
            const res = await fetch('/api/ambulances', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            }).then(r => r.json());
            if (res.status !== 'success') throw new Error(res.message || 'Failed to add ambulance');
            loadAmbulancesView();
        }
    );
}

async function recallAmbulance(ambulanceId) {
    if (!confirm('Recall AMB-' + ambulanceId + ' back to base?')) return;
    const res = await fetch('/api/ambulances/' + ambulanceId + '/recall', { method: 'PUT' }).then(r => r.json());
    if (res.status !== 'success') {
        alert(res.message || 'Recall failed');
        return;
    }
    loadAmbulancesView();
}

function openDispatchAmbulanceModal(ambulanceId) {
    fetch('/api/incidents?status=ACTIVE')
        .then(r => r.json())
        .then(res => {
            const incidents = res.data || [];
            const options = incidents.map(i => `<option value="${i.incident_id}">INC-${i.incident_id} — ${esc(i.title)} (${i.severity})</option>`).join('');

            openModal(
                `DISPATCH AMBULANCE AMB-${ambulanceId}`,
                `
                    <div class="form-group">
                        <label>TARGET ACTIVE INCIDENT</label>
                        <select id="f-disp-inc">${options || '<option value="">No Active Incidents</option>'}</select>
                    </div>
                `,
                async (root) => {
                    const incidentId = Number(root.querySelector('#f-disp-inc').value);
                    if (!incidentId) throw new Error('Active Incident required');

                    const res = await fetch('/api/ambulances/dispatch', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ ambulance_id: ambulanceId, incident_id: incidentId })
                    }).then(r => r.json());

                    if (res.status !== 'success') throw new Error(res.message || 'Dispatch failed');
                    loadAmbulancesView();
                }
            );
        });
}

/* 4. Rescue Teams Module */
/* 4. Rescue Teams Module */
function loadTeamsView() {
    fetch('/api/teams')
        .then(r => r.json())
        .then(res => {
            const data = res.data || [];
            const content = document.querySelector('.content');
            content.innerHTML = `
                <div class="module-toolbar">
                    <span class="toolbar-title">RESCUE TEAMS DIRECTORY [${data.length}]</span>
                    <button class="btn-cyan" id="btn-add-team">+ ADD RESCUE TEAM</button>
                </div>
                <div class="panel">
                    <div class="table-wrap">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>ID</th><th>TEAM NAME</th><th>TYPE</th><th>MEMBERS</th><th>STATUS</th><th>ACTION</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${data.length ? data.map(t => {
                                    const st = (t.status || '').toUpperCase();
                                    const members = t.members_count != null ? t.members_count : (t.members || '—');
                                    const ttype = t.team_type || t.type || '—';
                                    let action = '—';
                                    if (st === 'AVAILABLE' || st === 'STANDBY') {
                                        action = `<button class="btn-cyan btn-sm" onclick="openDispatchTeamModal(${t.team_id})">DEPLOY</button>`;
                                    } else if (st === 'DEPLOYED' || st === 'RESTING') {
                                        action = `<button class="btn-ghost btn-sm" onclick="recallTeam(${t.team_id})">RECALL</button>`;
                                    }
                                    return `
                                    <tr>
                                        <td class="row-id">TM-${esc(t.team_id)}</td>
                                        <td><strong>${esc(t.team_name || t.name)}</strong></td>
                                        <td>${esc(ttype)}</td>
                                        <td>${esc(members)} Personnel</td>
                                        <td><span class="sev-tag ${st === 'AVAILABLE' ? 'low' : st === 'DEPLOYED' ? 'high' : 'moderate'}">${esc(st)}</span></td>
                                        <td>${action}</td>
                                    </tr>`;
                                }).join('') : '<tr class="empty-row"><td colspan="6">NO TEAMS FOUND</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
            document.getElementById('btn-add-team').onclick = openAddTeamModal;
        });
}

function openAddTeamModal() {
    openModal(
        'REGISTER NEW RESCUE TEAM',
        `
            <div class="form-grid">
                <div class="full form-group">
                    <label>TEAM NAME</label>
                    <input id="f-team-name" placeholder="e.g. Echo Medical Squad" />
                </div>
                <div class="form-group">
                    <label>TEAM TYPE</label>
                    <select id="f-team-type">
                        <option>Fire</option>
                        <option>Hazmat</option>
                        <option>Medical</option>
                        <option>Search & Rescue</option>
                        <option>General</option>
                        <option>Water Rescue</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>MEMBERS COUNT</label>
                    <input id="f-team-members" type="number" min="1" value="6" />
                </div>
            </div>
        `,
        async (root) => {
            const payload = {
                team_name: root.querySelector('#f-team-name').value.trim(),
                team_type: root.querySelector('#f-team-type').value,
                members_count: Number(root.querySelector('#f-team-members').value) || 5
            };
            if (!payload.team_name) throw new Error('Team name required');
            const res = await fetch('/api/teams', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            }).then(r => r.json());
            if (res.status !== 'success') throw new Error(res.message || 'Failed to add team');
            loadTeamsView();
        }
    );
}

async function recallTeam(teamId) {
    if (!confirm('Recall TM-' + teamId + ' back to AVAILABLE?')) return;
    const res = await fetch('/api/teams/' + teamId + '/recall', { method: 'PUT' }).then(r => r.json());
    if (res.status !== 'success') {
        alert(res.message || 'Recall failed');
        return;
    }
    loadTeamsView();
}

function openDispatchTeamModal(teamId) {
    fetch('/api/incidents?status=ACTIVE')
        .then(r => r.json())
        .then(res => {
            const incidents = res.data || [];
            const options = incidents.map(i => `<option value="${i.incident_id}">INC-${i.incident_id} — ${esc(i.title)}</option>`).join('');

            openModal(
                `DEPLOY RESCUE TEAM TM-${teamId}`,
                `
                    <div class="form-group">
                        <label>TARGET ACTIVE INCIDENT</label>
                        <select id="f-disp-team-inc">${options || '<option value="">No Active Incidents</option>'}</select>
                    </div>
                `,
                async (root) => {
                    const incidentId = Number(root.querySelector('#f-disp-team-inc').value);
                    if (!incidentId) throw new Error('Active Incident required');

                    const res = await fetch('/api/teams/dispatch', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ team_id: teamId, incident_id: incidentId })
                    }).then(r => r.json());

                    if (res.status !== 'success') throw new Error(res.message || 'Deployment failed');
                    loadTeamsView();
                }
            );
        });
}

/* 5. Hospitals Module */
/* 5. Hospitals Module */
function loadHospitalsView() {
    fetch('/api/hospitals')
        .then(r => r.json())
        .then(res => {
            const data = res.data || [];
            const content = document.querySelector('.content');
            content.innerHTML = `
                <div class="module-toolbar">
                    <span class="toolbar-title">HOSPITAL CAPACITY DIRECTORY [${data.length}]</span>
                    <button class="btn-cyan" id="btn-add-hospital">+ ADD HOSPITAL</button>
                </div>
                <div class="panel">
                    <div class="table-wrap">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>ID</th><th>HOSPITAL NAME</th><th>LOCATION</th>
                                    <th>AVAILABLE BEDS</th><th>OCCUPIED BEDS</th><th>TOTAL BEDS</th><th>OCCUPANCY</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${data.length ? data.map(h => {
                                    const total = Number(h.total_beds) || 0;
                                    const occ = h.occupied_beds != null ? Number(h.occupied_beds)
                                              : Math.max(total - Number(h.available_beds || 0), 0);
                                    const avail = h.available_beds != null ? Number(h.available_beds)
                                               : Math.max(total - occ, 0);
                                    let rate = h.occupancy_rate;
                                    if (rate == null || rate === '' || Number(rate) === 0 && occ > 0) {
                                        rate = total ? Math.round((occ / total) * 100) : 0;
                                    }
                                    const rateNum = Number(rate) || 0;
                                    const rateColor = rateNum >= 90 ? 'var(--red)' : rateNum >= 70 ? 'var(--orange)' : 'var(--green)';
                                    return `
                                    <tr>
                                        <td class="row-id">HOS-${esc(h.hospital_id)}</td>
                                        <td><strong>${esc(h.name)}</strong></td>
                                        <td>${esc(h.location)}</td>
                                        <td style="color:var(--green)"><strong>${esc(avail)}</strong></td>
                                        <td style="color:var(--orange)">${esc(occ)}</td>
                                        <td>${esc(total)}</td>
                                        <td style="color:${rateColor}; font-weight:bold;">${esc(rateNum)}%</td>
                                    </tr>`;
                                }).join('') : '<tr class="empty-row"><td colspan="7">NO HOSPITALS FOUND</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
            document.getElementById('btn-add-hospital').onclick = openAddHospitalModal;
        });
}

function openAddHospitalModal() {
    openModal(
        'REGISTER NEW HOSPITAL',
        `
            <div class="form-grid">
                <div class="full form-group">
                    <label>HOSPITAL NAME</label>
                    <input id="f-hos-name" placeholder="e.g. Noida Trauma Center" />
                </div>
                <div class="full form-group">
                    <label>LOCATION</label>
                    <input id="f-hos-loc" placeholder="Sector / City" />
                </div>
                <div class="form-group">
                    <label>TOTAL BEDS</label>
                    <input id="f-hos-total" type="number" min="1" value="100" />
                </div>
                <div class="form-group">
                    <label>OCCUPIED BEDS</label>
                    <input id="f-hos-occ" type="number" min="0" value="0" />
                </div>
            </div>
        `,
        async (root) => {
            const payload = {
                name: root.querySelector('#f-hos-name').value.trim(),
                location: root.querySelector('#f-hos-loc').value.trim(),
                total_beds: Number(root.querySelector('#f-hos-total').value),
                occupied_beds: Number(root.querySelector('#f-hos-occ').value) || 0
            };
            if (!payload.name || !payload.total_beds) throw new Error('Name and total beds required');
            const res = await fetch('/api/hospitals', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            }).then(r => r.json());
            if (res.status !== 'success') throw new Error(res.message || 'Failed to add hospital');
            loadHospitalsView();
        }
    );
}

/* 6. Medical Resources Module */
/* 6. Medical Resources Module */
function loadResourcesView() {
    fetch('/api/resources')
        .then(r => r.json())
        .then(res => {
            const data = res.data || [];
            const content = document.querySelector('.content');
            content.innerHTML = `
                <div class="module-toolbar">
                    <span class="toolbar-title">MEDICAL RESOURCES INVENTORY [${data.length}]</span>
                    <div style="display:flex; gap:8px;">
                        <button class="btn-ghost" id="btn-add-resource">+ ADD RESOURCE</button>
                        <button class="btn-cyan" id="btn-open-alloc-resource">ALLOCATE RESOURCE</button>
                    </div>
                </div>
                <div class="panel">
                    <div class="table-wrap">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>ID</th><th>RESOURCE NAME</th><th>TYPE</th><th>AVAILABLE QUANTITY</th><th>UNIT</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${data.length ? data.map(resItem => {
                                    const id = resItem.resource_id || resItem.id || '—';
                                    const name = resItem.resource_name || resItem.name || '—';
                                    const type = resItem.resource_type || resItem.type || '—';
                                    const qty = resItem.quantity_available != null ? resItem.quantity_available
                                              : (resItem.quantity != null ? resItem.quantity : '—');
                                    const unit = resItem.unit || 'Units';
                                    return `
                                    <tr>
                                        <td class="row-id">RES-${esc(id)}</td>
                                        <td><strong>${esc(name)}</strong></td>
                                        <td>${esc(type)}</td>
                                        <td><strong style="color:var(--cyan)">${esc(qty)}</strong></td>
                                        <td>${esc(unit)}</td>
                                    </tr>`;
                                }).join('') : '<tr class="empty-row"><td colspan="5">NO RESOURCES IN INVENTORY</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
            document.getElementById('btn-open-alloc-resource').onclick = openAllocateResourceModal;
            document.getElementById('btn-add-resource').onclick = openAddResourceModal;
        });
}

function openAddResourceModal() {
    openModal(
        'ADD MEDICAL RESOURCE',
        `
            <div class="form-grid">
                <div class="full form-group">
                    <label>RESOURCE NAME</label>
                    <input id="f-res-name" placeholder="e.g. Trauma Kits" />
                </div>
                <div class="form-group">
                    <label>TYPE</label>
                    <input id="f-res-type" placeholder="Emergency Care" value="General" />
                </div>
                <div class="form-group">
                    <label>UNIT</label>
                    <input id="f-res-unit" placeholder="Units" value="Units" />
                </div>
                <div class="full form-group">
                    <label>AVAILABLE QUANTITY</label>
                    <input id="f-res-qty" type="number" min="0" value="10" />
                </div>
            </div>
        `,
        async (root) => {
            const payload = {
                resource_name: root.querySelector('#f-res-name').value.trim(),
                resource_type: root.querySelector('#f-res-type').value.trim() || 'General',
                unit: root.querySelector('#f-res-unit').value.trim() || 'Units',
                quantity_available: Number(root.querySelector('#f-res-qty').value) || 0
            };
            if (!payload.resource_name) throw new Error('Resource name required');
            const res = await fetch('/api/resources', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            }).then(r => r.json());
            if (res.status !== 'success') throw new Error(res.message || 'Failed to add resource');
            loadResourcesView();
        }
    );
}

function openAllocateResourceModal() {
    Promise.all([
        fetch('/api/incidents?status=ACTIVE').then(r => r.json()),
        fetch('/api/resources').then(r => r.json())
    ]).then(([incRes, resRes]) => {
        const incidents = incRes.data || [];
        const resources = resRes.data || [];

        const incOpts = incidents.map(i => `<option value="${i.incident_id}">INC-${i.incident_id} — ${esc(i.title)}</option>`).join('');
        const resOpts = resources.map(r => `<option value="${r.resource_id}">${esc(r.resource_name)} (${r.quantity_available} ${r.unit} available)</option>`).join('');

        openModal(
            'ALLOCATE MEDICAL RESOURCE TO INCIDENT',
            `
                <div class="form-grid">
                    <div class="full form-group">
                        <label>TARGET INCIDENT</label>
                        <select id="f-alloc-inc">${incOpts || '<option value="">No Active Incidents</option>'}</select>
                    </div>
                    <div class="full form-group">
                        <label>SELECT RESOURCE</label>
                        <select id="f-alloc-res">${resOpts}</select>
                    </div>
                    <div class="full form-group">
                        <label>QUANTITY TO ALLOCATE</label>
                        <input id="f-alloc-qty" type="number" min="1" value="1" />
                    </div>
                </div>
            `,
            async (root) => {
                const payload = {
                    incident_id: Number(root.querySelector('#f-alloc-inc').value),
                    resource_id: Number(root.querySelector('#f-alloc-res').value),
                    quantity: Number(root.querySelector('#f-alloc-qty').value)
                };
                if (!payload.incident_id || !payload.resource_id || !payload.quantity) {
                    throw new Error('All fields are required');
                }

                const res = await fetch('/api/resources/allocate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                }).then(r => r.json());

                if (res.status !== 'success') throw new Error(res.message || 'Allocation failed');
                loadResourcesView();
            }
        );
    });
}

/* 7. Blood Stock Module */
function loadBloodView() {
    fetch('/api/blood')
        .then(r => r.json())
        .then(res => {
            const data = res.data || [];
            const total = res.total_units || 0;
            const content = document.querySelector('.content');
            content.innerHTML = `
                <div class="module-toolbar">
                    <span class="toolbar-title">BLOOD BANK RESERVE [TOTAL: ${total} UNITS]</span>
                </div>
                <div class="panel">
                    <div class="table-wrap">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>BLOOD GROUP</th><th>AVAILABLE UNITS</th><th>STATUS</th><th>UPDATE UNITS</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${data.length ? data.map(b => `
                                    <tr>
                                        <td><strong style="color:var(--red); font-size:1.1rem;">${esc(b.blood_group)}</strong></td>
                                        <td><strong style="font-size:1.1rem; color:var(--text-0);">${esc(b.units_available)}</strong> Units</td>
                                        <td>
                                            <span class="sev-tag ${b.units_available < 10 ? 'critical' : b.units_available < 25 ? 'moderate' : 'low'}">
                                                ${b.units_available < 10 ? 'CRITICAL LOW' : b.units_available < 25 ? 'MODERATE' : 'ADEQUATE'}
                                            </span>
                                        </td>
                                        <td>
                                            <button class="btn-cyan btn-sm" onclick="openUpdateBloodModal('${esc(b.blood_group)}', ${b.units_available})">SET UNITS</button>
                                        </td>
                                    </tr>
                                `).join('') : '<tr class="empty-row"><td colspan="4">NO BLOOD DATA</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        });
}

function openUpdateBloodModal(bloodGroup, currentUnits) {
    openModal(
        `UPDATE BLOOD STOCK [GROUP ${bloodGroup}]`,
        `
            <div class="form-group">
                <label>NEW UNITS AVAILABLE</label>
                <input id="f-blood-qty" type="number" value="${currentUnits}" min="0" />
            </div>
        `,
        async (root) => {
            const units = Number(root.querySelector('#f-blood-qty').value);
            if (isNaN(units) || units < 0) throw new Error('Valid units required');

            const res = await fetch(`/api/blood/${encodeURIComponent(bloodGroup)}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ units_available: units })
            }).then(r => r.json());

            if (res.status !== 'success') throw new Error(res.message || 'Update failed');
            loadBloodView();
        }
    );
}

/* 8. Response Log Module */
function loadResponsesView() {
    fetch('/api/dashboard/recent-responses')
        .then(r => r.json())
        .then(res => {
            const data = res.data || [];
            const content = document.querySelector('.content');
            content.innerHTML = `
                <div class="module-toolbar">
                    <span class="toolbar-title">SYSTEM RESPONSE AUDIT LOG</span>
                </div>
                <div class="panel">
                    <div class="table-wrap">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>RESP ID</th><th>INCIDENT ID</th><th>RESPONSE UNIT</th><th>RESPONSE TIME</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${data.length ? data.map(r => `
                                    <tr>
                                        <td class="row-id">R-${esc(r.resp_id)}</td>
                                        <td>INC-${esc(r.incident_id)}</td>
                                        <td><strong>${esc(r.unit)}</strong></td>
                                        <td>${esc(r.response_minutes != null ? r.response_minutes + ' min' : '—')}</td>
                                    </tr>
                                `).join('') : '<tr class="empty-row"><td colspan="4">NO RESPONSES RECORDED</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        });
}

/* 9. Reports Module */
function loadReportsView() {
    Promise.all([
        fetch('/api/dashboard/stats').then(r => r.json()),
        fetch('/api/dashboard/recent-responses').then(r => r.json()),
        fetch('/api/incidents').then(r => r.json())
    ]).then(([statsRes, respRes, incRes]) => {
        const s = (statsRes.stats || {});
        const responses = (respRes.data || []);
        const incidents = (incRes.data || []);
        const content = document.querySelector('.content');
        content.innerHTML = `
            <div class="module-toolbar">
                <span class="toolbar-title">OPS REPORTS & AUDIT</span>
            </div>
            <div class="panel" style="margin-bottom:1rem; padding:1rem;">
                <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(140px,1fr)); gap:12px; font-family:var(--mono);">
                    <div><div style="color:var(--text-2);font-size:0.7rem;">ACTIVE INCIDENTS</div><div style="color:var(--cyan);font-size:1.4rem;font-weight:bold;">${esc(s.active_incidents ?? incidents.length)}</div></div>
                    <div><div style="color:var(--text-2);font-size:0.7rem;">VICTIMS</div><div style="color:var(--cyan);font-size:1.4rem;font-weight:bold;">${esc(s.total_victims ?? '—')}</div></div>
                    <div><div style="color:var(--text-2);font-size:0.7rem;">AVAILABLE AMBULANCES</div><div style="color:var(--cyan);font-size:1.4rem;font-weight:bold;">${esc(s.available_ambulances ?? '—')}</div></div>
                    <div><div style="color:var(--text-2);font-size:0.7rem;">AVAILABLE BEDS</div><div style="color:var(--cyan);font-size:1.4rem;font-weight:bold;">${esc(s.available_beds ?? '—')}</div></div>
                    <div><div style="color:var(--text-2);font-size:0.7rem;">ALERTS (24h)</div><div style="color:var(--cyan);font-size:1.4rem;font-weight:bold;">${esc(s.recent_alerts ?? '—')}</div></div>
                </div>
            </div>
            <div class="panel">
                <div class="table-wrap">
                    <table class="data-table">
                        <thead>
                            <tr><th>RESP ID</th><th>INCIDENT</th><th>UNIT</th><th>RESPONSE TIME</th></tr>
                        </thead>
                        <tbody>
                            ${responses.length ? responses.map(r => `
                                <tr>
                                    <td class="row-id">R-${esc(r.resp_id)}</td>
                                    <td>INC-${esc(r.incident_id)}</td>
                                    <td><strong>${esc(r.unit)}</strong></td>
                                    <td>${esc(r.response_minutes != null ? r.response_minutes + ' min' : '—')}</td>
                                </tr>
                            `).join('') : '<tr class="empty-row"><td colspan="4">NO RESPONSE AUDIT RECORDS YET — dispatch units to generate logs</td></tr>'}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }).catch(err => {
        console.error(err);
        loadPlaceholderView('reports');
    });
}

/* 10. Emergency Requests Module */
function loadRequestsView() {
    fetch('/api/alerts')
        .then(r => r.json())
        .then(res => {
            const data = res.data || [];
            const content = document.querySelector('.content');
            content.innerHTML = `
                <div class="module-toolbar">
                    <span class="toolbar-title">EMERGENCY REQUESTS & ALERTS [${data.length}]</span>
                    <button class="btn-cyan" id="btn-new-request">+ NEW REQUEST ALERT</button>
                </div>
                <div class="panel">
                    <div class="table-wrap">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>ID</th><th>LEVEL</th><th>MESSAGE</th><th>TIME</th><th>STATUS</th><th>ACTION</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${data.length ? data.map(a => `
                                    <tr>
                                        <td class="row-id">ALR-${esc(a.alert_id)}</td>
                                        <td><span class="sev-tag ${(a.alert_level || 'info').toLowerCase()}">${esc(a.alert_level)}</span></td>
                                        <td>${esc(a.message)}</td>
                                        <td>${esc(fmtTime(a.alert_time))}</td>
                                        <td>${a.is_acknowledged ? '<span style="color:var(--green)">ACK</span>' : '<span style="color:var(--orange)">OPEN</span>'}</td>
                                        <td>
                                            ${!a.is_acknowledged ? `<button class="btn-cyan btn-sm" onclick="ackAlert(${a.alert_id})">ACK</button>` : '—'}
                                        </td>
                                    </tr>
                                `).join('') : '<tr class="empty-row"><td colspan="6">NO OPEN REQUESTS</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
            document.getElementById('btn-new-request').onclick = openNewRequestModal;
        });
}

function openNewRequestModal() {
    openModal(
        'CREATE EMERGENCY REQUEST ALERT',
        `
            <div class="form-grid">
                <div class="form-group">
                    <label>ALERT LEVEL</label>
                    <select id="f-req-level">
                        <option value="CRITICAL">CRITICAL</option>
                        <option value="HIGH">HIGH</option>
                        <option value="INFO" selected>INFO</option>
                    </select>
                </div>
                <div class="full form-group">
                    <label>REQUEST / MESSAGE</label>
                    <input id="f-req-msg" placeholder="e.g. Need 2 ALS ambulances at Sector 18" />
                </div>
            </div>
        `,
        async (root) => {
            const level = root.querySelector('#f-req-level').value;
            const message = root.querySelector('#f-req-msg').value.trim();
            if (!message) throw new Error('Message required');

            // Use incidents create-adjacent path: insert via a lightweight alerts POST if present,
            // otherwise fall back to acknowledging flow after manual SQL-less insert attempt.
            let res = await fetch('/api/alerts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ alert_level: level, message })
            }).then(r => r.json()).catch(() => ({ status: 'error' }));

            if (res.status !== 'success') {
                // Fallback: create a LOW incident-style note through existing incident API is overkill;
                // show clear instruction if backend route missing.
                throw new Error(res.message || 'Alert POST not available — add POST /api/alerts in api.py');
            }
            loadRequestsView();
        }
    );
}

async function ackAlert(alertId) {
    const res = await fetch('/api/alerts/' + alertId + '/ack', { method: 'PUT' }).then(r => r.json());
    if (res.status !== 'success') {
        alert(res.message || 'Ack failed');
        return;
    }
    loadRequestsView();
}