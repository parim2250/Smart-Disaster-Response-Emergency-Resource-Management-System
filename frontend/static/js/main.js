/**
 * SENTINEL — Emergency Command Interface
 * Dashboard live data + navigation
 */

document.addEventListener('DOMContentLoaded', function () {
    console.log('[SENTINEL] Interface initialized.');
    initClock();
    initSidebarToggle();
    initNavigation();
    checkDatabaseLink();
    loadDashboard();

    setInterval(checkDatabaseLink, 30000);
    setInterval(loadDashboard, 60000); // refresh every 60s
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

/* ===================== SIDEBAR ===================== */
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
            const label = this.querySelector('span:nth-of-type(2)').textContent;
            if (pageTitle) pageTitle.textContent = label.toUpperCase();
            console.log('[SENTINEL] Nav → ' + this.dataset.page);
            // Module pages in Phase 5
        });
    });

    document.querySelectorAll('.panel-link').forEach(function (link) {
        link.addEventListener('click', function (e) {
            e.preventDefault();
            const target = this.dataset.page;
            const navLink = document.querySelector('.nav-item[data-page="' + target + '"]');
            if (navLink) navLink.click();
        });
    });
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
    // MySQL datetime string or ISO
    var s = String(dt).replace('T', ' ').substring(0, 19);
    return s;
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

function sevClass(sev) {
    sev = (sev || '').toUpperCase();
    if (sev === 'CRITICAL') return 'critical';
    if (sev === 'HIGH') return 'high';
    if (sev === 'MODERATE') return 'moderate';
    return 'low';
}

/* ===================== DASHBOARD LOADER ===================== */
function loadDashboard() {
    loadStats();
    loadAlerts();
    loadRecentIncidents();
    loadRecentResponses();
    loadMapIncidents();
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
            setText('s-incidents-meta',
                (sev.CRITICAL || 0) + ' critical · ' + (sev.HIGH || 0) + ' high');

            setText('s-victims', s.total_victims);
            setText('s-victims-meta', 'registered in system');

            setText('s-ambulances', s.available_ambulances);
            setText('s-ambulances-meta',
                (fleet.DISPATCHED || 0) + ' dispatched · ' + (fleet.MAINTENANCE || 0) + ' OOS');

            setText('s-teams', s.deployed_teams);
            setText('s-teams-meta', 'currently deployed');

            setText('s-beds', s.available_beds);
            setText('s-beds-meta', (beds.occupied || 0) + ' occupied / ' + (beds.total || 0) + ' total');

            setText('s-alerts', s.recent_alerts);
            setText('s-alerts-meta', 'last 24 hours');

            // Nav badge
            setText('nav-badge-incidents', s.active_incidents);

            // Severity bars
            var totalSev = (sev.CRITICAL || 0) + (sev.HIGH || 0) + (sev.MODERATE || 0) + (sev.LOW || 0);
            totalSev = totalSev || 1;
            setSev('critical', sev.CRITICAL || 0, totalSev);
            setSev('high', sev.HIGH || 0, totalSev);
            setSev('moderate', sev.MODERATE || 0, totalSev);
            setSev('low', sev.LOW || 0, totalSev);

            // Fleet panel
            setText('fleet-available', fleet.AVAILABLE || 0);
            setText('fleet-dispatched', fleet.DISPATCHED || 0);
            setText('fleet-oos', fleet.MAINTENANCE || 0);
            var fleetTotal = (fleet.AVAILABLE || 0) + (fleet.DISPATCHED || 0) + (fleet.MAINTENANCE || 0);
            var fleetOps = (fleet.AVAILABLE || 0) + (fleet.DISPATCHED || 0);
            var fleetPct = fleetTotal ? Math.round((fleetOps / fleetTotal) * 100) : 0;
            var fleetBar = document.getElementById('fleet-bar');
            if (fleetBar) fleetBar.style.width = fleetPct + '%';
            setText('fleet-ratio', fleetOps + ' / ' + fleetTotal + ' units operational');

            // Beds panel
            setText('bed-available', beds.available || 0);
            setText('bed-occupied', beds.occupied || 0);
            setText('bed-total', beds.total || 0);
            var bedPct = beds.total ? Math.round((beds.occupied / beds.total) * 100) : 0;
            var bedBar = document.getElementById('bed-bar');
            if (bedBar) bedBar.style.width = bedPct + '%';
            setText('bed-ratio', bedPct + '% capacity used');

            // Blood grid
            var bg = document.getElementById('blood-grid');
            if (bg && blood.length) {
                bg.innerHTML = blood.map(function (b) {
                    return '<div class="blood-cell">' +
                        '<span class="bc-type">' + esc(b.blood_group) + '</span>' +
                        '<span class="bc-qty">' + esc(b.units_available) + '</span>' +
                        '</div>';
                }).join('');
            }

            // Map footer
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
    var fill = document.querySelector('.sev-fill.' + (key === 'critical' ? 'crit' : key === 'moderate' ? 'mod' : key));
    // map keys: critical->crit, high->high, moderate->mod, low->low
    var map = { critical: 'crit', high: 'high', moderate: 'mod', low: 'low' };
    fill = document.querySelector('.sev-fill.' + map[key]);
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
                if (lvl === 'critical') lvl = 'critical';
                else if (lvl === 'high') lvl = 'high';
                else if (lvl === 'moderate') lvl = 'moderate';
                else lvl = 'info';
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
                var dot =
                    sev === 'CRITICAL' ? 'red' :
                    sev === 'HIGH' ? 'orange' :
                    sev === 'MODERATE' ? 'yellow' : 'green';
                var st = (i.status || '').toUpperCase();
                var stClass = st === 'ACTIVE' ? 'status-active' :
                              st === 'CONTAINED' ? 'status-contained' : 'status-contained';
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

function loadMapIncidents() {
    fetch('/api/dashboard/map-incidents')
        .then(function (r) { return r.json(); })
        .then(function (res) {
            var data = res.data || [];
            var svg = document.querySelector('.map-svg');
            if (!svg) return;

            // Remove old dynamic markers
            svg.querySelectorAll('.dyn-marker').forEach(function (el) { el.remove(); });

            var placeholder = document.getElementById('map-placeholder');
            if (!data.length) {
                if (placeholder) placeholder.style.display = 'block';
                return;
            }
            if (placeholder) placeholder.style.display = 'none';

            // Project lat/lng into SVG viewBox roughly (decorative, not geo-accurate)
            // Center around sample data region ~ lat 37.5, lng -122
            data.forEach(function (inc, idx) {
                var lat = parseFloat(inc.latitude);
                var lng = parseFloat(inc.longitude);
                if (isNaN(lat) || isNaN(lng)) return;

                // Simple projection into 800x420 canvas
                var x = 100 + ((lng + 123.0) / 4.0) * 600;
                var y = 80 + ((38.5 - lat) / 2.0) * 300;
                x = Math.max(80, Math.min(720, x));
                y = Math.max(60, Math.min(360, y));

                var sev = (inc.severity || 'LOW').toUpperCase();
                var color =
                    sev === 'CRITICAL' ? '#ef4444' :
                    sev === 'HIGH' ? '#f97316' :
                    sev === 'MODERATE' ? '#eab308' : '#22c55e';

                var g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                g.setAttribute('class', 'dyn-marker');
                g.setAttribute('transform', 'translate(' + x + ',' + y + ')');

                if (sev === 'CRITICAL') {
                    var ring = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                    ring.setAttribute('r', '22');
                    ring.setAttribute('fill', 'none');
                    ring.setAttribute('stroke', color);
                    ring.setAttribute('stroke-width', '1.5');
                    ring.setAttribute('opacity', '0.45');
                    ring.setAttribute('class', 'pulse-ring');
                    g.appendChild(ring);
                }

                var c1 = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                c1.setAttribute('r', '10');
                c1.setAttribute('fill', color.replace(')', ', 0.25)').replace('rgb', 'rgba').replace('#', '') ? hexRgba(color, 0.25) : color);
                c1.setAttribute('fill', hexRgba(color, 0.3));
                c1.setAttribute('stroke', color);
                c1.setAttribute('stroke-width', '2');
                g.appendChild(c1);

                var c2 = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                c2.setAttribute('r', '4');
                c2.setAttribute('fill', color);
                g.appendChild(c2);

                var label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                label.setAttribute('x', '16');
                label.setAttribute('y', '-6');
                label.setAttribute('fill', color);
                label.setAttribute('font-size', '10');
                label.setAttribute('font-family', 'JetBrains Mono');
                label.setAttribute('font-weight', '600');
                label.textContent = 'INC-' + inc.incident_id;
                g.appendChild(label);

                var sub = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                sub.setAttribute('x', '16');
                sub.setAttribute('y', '8');
                sub.setAttribute('fill', color);
                sub.setAttribute('opacity', '0.85');
                sub.setAttribute('font-size', '9');
                sub.setAttribute('font-family', 'JetBrains Mono');
                sub.textContent = inc.incident_type;
                g.appendChild(sub);

                svg.appendChild(g);
            });
        })
        .catch(function (e) { console.error('[SENTINEL] map error', e); });
}

function hexRgba(hex, alpha) {
    hex = hex.replace('#', '');
    var r = parseInt(hex.substring(0, 2), 16);
    var g = parseInt(hex.substring(2, 4), 16);
    var b = parseInt(hex.substring(4, 6), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
}