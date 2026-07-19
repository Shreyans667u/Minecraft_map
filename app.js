// ===== Cartograph app logic =====

const els = {
  loading: document.getElementById('loading'),
  searchForm: document.getElementById('searchForm'),
  searchInput: document.getElementById('searchInput'),
  results: document.getElementById('results'),
  routeCard: document.getElementById('routeCard'),
  routeDist: document.getElementById('routeDist'),
  routeTime: document.getElementById('routeTime'),
  routeSteps: document.getElementById('routeSteps'),
  closeRoute: document.getElementById('closeRoute'),
  locateBtn: document.getElementById('locateBtn'),
  zoomIn: document.getElementById('zoomIn'),
  zoomOut: document.getElementById('zoomOut'),
  coordReadout: document.getElementById('coordReadout'),
  installBanner: document.getElementById('installBanner'),
  installBtn: document.getElementById('installBtn'),
  dismissInstall: document.getElementById('dismissInstall'),
  modeBtns: Array.from(document.querySelectorAll('.mode')),
};

let map, userMarker, routeLine, destMarker;
let userLatLng = null;
let travelMode = 'foot'; // foot | bike | driving (maps to OSRM profiles)

function showLoading(msg) {
  els.loading.textContent = msg || 'Loading chunks…';
  els.loading.classList.remove('hidden');
}
function hideLoading() { els.loading.classList.add('hidden'); }

function initMap() {
  map = L.map('map', {
    zoomControl: false,
    attributionControl: false,
    center: [20, 0],
    zoom: 3,
  });

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    subdomains: 'abc',
  }).addTo(map);

  map.on('moveend zoomend', updateCoordReadout);
  updateCoordReadout();
  hideLoading();
  locateUser(true);
}

// Minecraft-map-item pointer icon (rotates like the in-game map arrow)
function arrowIcon(heading) {
  const rot = heading || 0;
  return L.divIcon({
    className: '',
    html: `<div class="player-marker" style="transform: rotate(${rot}deg); transition: transform .2s;">
      <svg viewBox="0 0 24 24" width="22" height="22">
        <polygon points="12,2 20,20 12,15 4,20" fill="#c42a22" stroke="#2b2113" stroke-width="1.5"/>
      </svg>
    </div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

function locateUser(silent) {
  if (!navigator.geolocation) {
    if (!silent) alert('This device has no compass (geolocation unavailable).');
    return;
  }
  showLoading('Finding your coordinates…');
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      hideLoading();
      userLatLng = [pos.coords.latitude, pos.coords.longitude];
      if (!userMarker) {
        userMarker = L.marker(userLatLng, { icon: arrowIcon(pos.coords.heading) }).addTo(map);
      } else {
        userMarker.setLatLng(userLatLng);
        userMarker.setIcon(arrowIcon(pos.coords.heading));
      }
      map.setView(userLatLng, 16);
    },
    (err) => {
      hideLoading();
      if (!silent) alert('Could not find you: ' + err.message);
      map.setView([20, 0], 3);
    },
    { enableHighAccuracy: true, timeout: 8000 }
  );
}

function updateCoordReadout() {
  const c = map.getCenter();
  els.coordReadout.textContent =
    `XYZ: ${c.lat.toFixed(3)}, ${map.getZoom()}, ${c.lng.toFixed(3)}`;
}

// ===== Search (Nominatim) =====
let searchTimer = null;
els.searchInput.addEventListener('input', () => {
  clearTimeout(searchTimer);
  const q = els.searchInput.value.trim();
  if (q.length < 3) { els.results.classList.add('hidden'); return; }
  searchTimer = setTimeout(() => runSearch(q), 400);
});

els.searchForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const q = els.searchInput.value.trim();
  if (q) runSearch(q);
});

async function runSearch(q) {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(q)}&limit=6`;
    const res = await fetch(url, { headers: { 'Accept-Language': navigator.language || 'en' } });
    const data = await res.json();
    renderResults(data);
  } catch (e) {
    console.error(e);
  }
}

function renderResults(items) {
  els.results.innerHTML = '';
  if (!items.length) { els.results.classList.add('hidden'); return; }
  items.forEach((item) => {
    const li = document.createElement('li');
    li.textContent = item.display_name;
    li.addEventListener('click', () => selectDestination(item));
    els.results.appendChild(li);
  });
  els.results.classList.remove('hidden');
}

function selectDestination(item) {
  els.results.classList.add('hidden');
  els.searchInput.value = item.display_name.split(',')[0];
  const latlng = [parseFloat(item.lat), parseFloat(item.lon)];

  if (destMarker) map.removeLayer(destMarker);
  destMarker = L.marker(latlng).addTo(map);
  map.setView(latlng, 15);

  if (userLatLng) {
    routeTo(userLatLng, latlng);
  } else {
    showLoading('No starting point — tap ◎ to find yourself first.');
    setTimeout(hideLoading, 1800);
  }
}

// ===== Routing (OSRM public demo server) =====
const OSRM_PROFILE = { foot: 'foot', bike: 'bike', driving: 'driving' };

async function routeTo(from, to) {
  showLoading('Charting the path…');
  const profile = OSRM_PROFILE[travelMode];
  const url = `https://router.project-osrm.org/route/v1/${profile}/${from[1]},${from[0]};${to[1]},${to[0]}?overview=full&geometries=geojson&steps=true`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    hideLoading();
    if (!data.routes || !data.routes.length) {
      alert('No path found through this terrain.');
      return;
    }
    drawRoute(data.routes[0]);
  } catch (e) {
    hideLoading();
    console.error(e);
    alert('The map spirits could not find a route right now.');
  }
}

function drawRoute(route) {
  if (routeLine) map.removeLayer(routeLine);
  const coords = route.geometry.coordinates.map((c) => [c[1], c[0]]);
  routeLine = L.polyline(coords, {
    color: '#c42a22',
    weight: 5,
    opacity: 0.9,
    dashArray: '1 10',
    lineCap: 'square',
  }).addTo(map);
  map.fitBounds(routeLine.getBounds(), { padding: [40, 40] });

  const km = (route.distance / 1000).toFixed(1);
  const mins = Math.round(route.duration / 60);
  els.routeDist.textContent = `${km} km`;
  els.routeTime.textContent = `${mins} min`;

  els.routeSteps.innerHTML = '';
  route.legs[0].steps.forEach((step) => {
    const div = document.createElement('div');
    const instr = step.maneuver && step.maneuver.type ? describeStep(step) : step.name;
    div.textContent = instr;
    els.routeSteps.appendChild(div);
  });

  els.routeCard.classList.remove('hidden');
}

function describeStep(step) {
  const m = step.maneuver;
  const road = step.name || 'the path';
  const dist = step.distance > 950 ? `${(step.distance / 1000).toFixed(1)} km` : `${Math.round(step.distance)} m`;
  const verbs = {
    depart: 'Head out',
    arrive: 'Arrive at',
    turn: `Turn ${m.modifier || ''}`,
    'new name': 'Continue',
    continue: 'Continue',
    merge: 'Merge',
    roundabout: 'Take the roundabout',
    fork: `Bear ${m.modifier || ''}`,
  };
  const verb = verbs[m.type] || 'Continue';
  return `${verb} on ${road} — ${dist}`;
}

els.closeRoute.addEventListener('click', () => {
  els.routeCard.classList.add('hidden');
  if (routeLine) { map.removeLayer(routeLine); routeLine = null; }
});

els.modeBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    els.modeBtns.forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    travelMode = btn.dataset.mode;
    if (userLatLng && destMarker) routeTo(userLatLng, destMarker.getLatLng());
  });
});

els.locateBtn.addEventListener('click', () => locateUser(false));
els.zoomIn.addEventListener('click', () => map.zoomIn());
els.zoomOut.addEventListener('click', () => map.zoomOut());

// ===== PWA install prompt =====
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  if (!localStorage.getItem('cartograph_install_dismissed')) {
    els.installBanner.classList.remove('hidden');
  }
});
els.installBtn.addEventListener('click', async () => {
  els.installBanner.classList.add('hidden');
  if (deferredPrompt) {
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
  }
});
els.dismissInstall.addEventListener('click', () => {
  els.installBanner.classList.add('hidden');
  localStorage.setItem('cartograph_install_dismissed', '1');
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').catch(console.error);
  });
}

showLoading('Generating world…');
initMap();
