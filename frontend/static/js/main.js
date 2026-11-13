/**
 * SENTINEL — Emergency Command Interface
 * Dashboard behavior: clock, navigation, DB link status.
 * Real data wiring happens in Phase 4.
 */

document.addEventListener('DOMContentLoaded', function () {
    console.log('[SENTINEL] Interface initialized.');

    initClock();
    initSidebarToggle();
    initNavigation();
    checkDatabaseLink();

    // Refresh DB link indicator every 30s
    setInterval(checkDatabaseLink, 30000);
});

/* ============================================================
   LIVE CLOCK
   ============================================================ */
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

/* ============================================================
   SIDEBAR TOGGLE (mobile)
   ============================================================ */
function initSidebarToggle() {
    const btn = document.getElementById('sb-toggle');
    const sb = document.getElementById('sidebar');
    if (!btn || !sb) return;

    btn.addEventListener('click', function () {
        sb.classList.toggle('open');
    });

    // Close sidebar when a nav link is clicked on mobile
    sb.querySelectorAll('.nav-item').forEach(function (item) {
        item.addEventListener('click', function () {
            if (window.innerWidth <= 768) sb.classList.remove('open');
        });
    });
}

/* ============================================================
   NAVIGATION
   ============================================================ */
function initNavigation() {
    const items = document.querySelectorAll('.nav-item');
    const pageTitle = document.getElementById('page-title');

    items.forEach(function (item) {
        item.addEventListener('click', function (e) {
            e.preventDefault();
            items.forEach(function (i) { i.classList.remove('active'); });
            this.classList.add('active');

            const page = this.dataset.page;
            const label = this.querySelector('span:nth-of-type(2)').textContent;
            if (pageTitle) pageTitle.textContent = label.toUpperCase();

            console.log('[SENTINEL] Navigation → ' + page);
            // Actual module pages will be rendered in Phase 5.
        });
    });

    // Panel view-all shortcuts
    document.querySelectorAll('.panel-link').forEach(function (link) {
        link.addEventListener('click', function (e) {
            e.preventDefault();
            const target = this.dataset.page;
            const navLink = document.querySelector('.nav-item[data-page="' + target + '"]');
            if (navLink) navLink.click();
        });
    });
}

/* ============================================================
   DATABASE LINK CHECK
   ============================================================ */
function checkDatabaseLink() {
    const dot = document.getElementById('db-link-dot');
    const value = document.getElementById('db-link-value');

    fetch('/api/health')
        .then(function (r) { return r.json(); })
        .then(function (data) {
            const ok = data.database && data.database.status === 'success';
            if (ok) {
                if (dot) dot.className = 'status-indicator ok';
                if (value) value.textContent = 'ONLINE';
            } else {
                if (dot) dot.className = 'status-indicator err';
                if (value) value.textContent = 'OFFLINE';
            }
        })
        .catch(function () {
            if (dot) dot.className = 'status-indicator err';
            if (value) value.textContent = 'OFFLINE';
        });
}