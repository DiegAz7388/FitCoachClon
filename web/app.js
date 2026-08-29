const config = window.ARNOLD_V2_CONFIG || {};
const APP = document.querySelector('#app');
const SESSION_KEY = 'fitcoach-arnold-v2-session';
const DRAFTS_KEY = 'fitcoach-admin-offline-drafts';

const demoClients = [
  { id: 'demo-1', full_name: 'Carla Mendoza', email: 'carla@fitcoach.mx', phone: '662 555 0148', status: 'active', goal: 'Bajar grasa corporal', height_cm: 165, notes: 'Evitar peso libre en pierna derecha.', created_at: '2026-08-10' },
  { id: 'demo-2', full_name: 'Ana García', email: 'ana@fitcoach.mx', phone: '662 555 0172', status: 'active', goal: 'Ganar fuerza', height_cm: 160, notes: '', created_at: '2026-08-12' },
  { id: 'demo-3', full_name: 'Jorge Pérez', email: 'jorge@fitcoach.mx', phone: '662 555 0161', status: 'active', goal: 'Hipertrofia', height_cm: 178, notes: '', created_at: '2026-08-17' },
  { id: 'demo-4', full_name: 'Luis Torres', email: 'luis@fitcoach.mx', phone: '662 555 0185', status: 'expiring', goal: 'Aumentar masa muscular', height_cm: 173, notes: 'Revisar técnica de sentadilla.', created_at: '2026-08-20' },
  { id: 'demo-5', full_name: 'María González', email: 'maria@fitcoach.mx', phone: '662 555 0134', status: 'expiring', goal: 'Tonificar', height_cm: 168, notes: '', created_at: '2026-08-22' },
  { id: 'demo-6', full_name: 'Roberto Cruz', email: 'roberto@fitcoach.mx', phone: '662 555 0198', status: 'expired', goal: 'Fuerza base', height_cm: 181, notes: 'Retomar evaluación antes de activar.', created_at: '2026-07-20' },
];

const starterExercises = [
  { id: 'local-squat', name: 'Sentadilla con barra', category: 'upper legs', equipment: 'barbell', target: 'quadriceps', muscle_group: 'quadriceps', secondary_muscles: ['glutes'], instruction_steps: { es: ['Coloca la barra sobre los trapecios.', 'Desciende con el torso firme y las rodillas alineadas.', 'Empuja el suelo para volver a la posición inicial.'] } },
  { id: 'local-press', name: 'Press de pecho con barra', category: 'chest', equipment: 'barbell', target: 'pectorals', muscle_group: 'pectorals', secondary_muscles: ['triceps'], instruction_steps: { es: ['Apoya la espalda y los pies firmemente.', 'Baja la barra con control hacia el pecho.', 'Empuja hasta extender los brazos sin bloquear.'] } },
  { id: 'local-row', name: 'Remo con mancuerna', category: 'back', equipment: 'dumbbell', target: 'lats', muscle_group: 'lats', secondary_muscles: ['biceps'], instruction_steps: { es: ['Apoya una mano y mantén la espalda neutra.', 'Lleva el codo hacia la cadera.', 'Baja la mancuerna con control.'] } },
  { id: 'local-plank', name: 'Plancha frontal', category: 'waist', equipment: 'body weight', target: 'abs', muscle_group: 'abs', secondary_muscles: ['shoulders'], instruction_steps: { es: ['Apoya antebrazos y puntas de los pies.', 'Mantén una línea recta de hombros a talones.', 'Respira sin perder la tensión abdominal.'] } },
];

const state = {
  view: 'dashboard',
  clients: structuredClone(demoClients),
  routines: [
    { id: 'routine-demo-1', client_id: 'demo-1', name: 'Cuerpo completo A', days: [{ day: 1, exercises: starterExercises.slice(0, 4) }, { day: 3, exercises: starterExercises.slice(0, 4) }, { day: 5, exercises: starterExercises.slice(0, 4) }] },
    { id: 'routine-demo-2', client_id: 'demo-4', name: 'Fuerza base', days: [{ day: 2, exercises: starterExercises.slice(0, 3) }, { day: 4, exercises: starterExercises.slice(0, 3) }] },
  ],
  exercises: starterExercises,
  filteredExercises: starterExercises,
  clientFilter: 'all',
  exerciseSearch: '',
  exerciseCategory: 'all',
  remote: { configured: Boolean(config.supabaseUrl && config.supabasePublishableKey), session: readSession(), user: null },
  modal: null,
  toast: '',
};

function readSession() { try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch { return null; } }
function saveSession(session) { state.remote.session = session; localStorage.setItem(SESSION_KEY, JSON.stringify(session)); }
function hasRemoteSession() { return Boolean(state.remote.configured && state.remote.session?.access_token); }
function isRemote() { return hasRemoteSession(); }
function initials(name = '') { return name.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase() || 'FC'; }
function escapeHtml(value = '') { return String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char])); }
function textStatus(status) { return ({ active: 'Activo', expiring: 'Por vencer', expired: 'Inactivo', paused: 'Pausado' }[status] || status); }
function statusClass(status) { return status === 'active' ? 'active' : status === 'expiring' ? 'expiring' : status === 'expired' ? 'expired' : 'neutral'; }
function dayName(day) { return ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][day] || 'Día'; }
function toast(message) { state.toast = message; render(); window.clearTimeout(window.__toast); window.__toast = window.setTimeout(() => { state.toast = ''; render(); }, 3200); }

async function api(path, options = {}) {
  if (!hasRemoteSession()) throw new Error('Inicia sesión en Arnold V2 antes de sincronizar.');
  const headers = new Headers(options.headers || {});
  headers.set('apikey', config.supabasePublishableKey);
  headers.set('Authorization', `Bearer ${state.remote.session.access_token}`);
  if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const response = await fetch(`${config.supabaseUrl.replace(/\/$/, '')}${path}`, { ...options, headers });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Error ${response.status}`);
  }
  if (response.status === 204) return null;
  return response.json();
}

async function signIn(form) {
  const email = form.querySelector('[name=email]').value.trim();
  const password = form.querySelector('[name=password]').value;
  const response = await fetch(`${config.supabaseUrl.replace(/\/$/, '')}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: { apikey: config.supabasePublishableKey, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error_description || result.msg || 'No se pudo iniciar sesión.');
  saveSession(result);
  state.remote.user = result.user;
  await loadRemoteData();
  state.modal = null;
  toast('Arnold V2 conectado correctamente.');
}

async function loadRemoteData() {
  const [clients, routines] = await Promise.all([
    api('/rest/v1/fc_clients?select=*&order=created_at.desc'),
    api('/rest/v1/fc_routines?select=id,client_id,name,session_minutes,days_per_week,is_active,created_at&is_active=eq.true&order=created_at.desc'),
  ]);
  state.clients = clients;
  state.routines = routines.map((routine) => ({ ...routine, days: [] }));
  const routineIds = state.routines.map((routine) => routine.id);
  if (routineIds.length) {
    const ids = routineIds.join(',');
    const [days, exercises] = await Promise.all([
      api(`/rest/v1/fc_routine_days?select=routine_id,day_of_week,label&routine_id=in.(${ids})&order=day_of_week.asc`),
      api(`/rest/v1/fc_routine_exercises?select=routine_id,day_of_week,order_index,sets,reps_min,reps_max,exercise:fc_exercises(id,name,muscle_group)&routine_id=in.(${ids})&order=order_index.asc`),
    ]);
    state.routines.forEach((routine) => {
      routine.days = days.filter((day) => String(day.routine_id) === String(routine.id)).map((day) => ({
        day: day.day_of_week, label: day.label,
        exercises: exercises.filter((item) => String(item.routine_id) === String(routine.id) && item.day_of_week === day.day_of_week).map((item) => ({
          id: item.exercise?.id, name: item.exercise?.name || 'Ejercicio', muscle_group: item.exercise?.muscle_group, sets: item.sets, reps: item.reps_min === item.reps_max ? String(item.reps_min) : `${item.reps_min}-${item.reps_max}`,
        })),
      }));
    });
  }
  return state.clients;
}

async function loadExercises() {
  try {
    const response = await fetch('./data/exercises.json');
    if (!response.ok) throw new Error('No se pudo leer el catálogo local.');
    const exercises = await response.json();
    state.exercises = exercises;
    applyExerciseFilter();
    render();
  } catch {
    state.exercises = starterExercises;
    applyExerciseFilter();
    render();
    toast('Se está usando el catálogo de respaldo sin conexión.');
  }
}

function applyExerciseFilter() {
  const needle = state.exerciseSearch.trim().toLowerCase();
  state.filteredExercises = state.exercises.filter((exercise) => {
    const matchesText = !needle || [exercise.name, exercise.category, exercise.target, exercise.equipment, exercise.muscle_group].filter(Boolean).join(' ').toLowerCase().includes(needle);
    return matchesText && (state.exerciseCategory === 'all' || exercise.category === state.exerciseCategory);
  });
}

function navButton(view, icon, label) { return `<button data-nav="${view}" class="${state.view === view ? 'active' : ''}"><span>${icon}</span>${label}</button>`; }
function shell(content) {
  const remoteLabel = isRemote() ? 'Arnold V2 conectado' : state.remote.configured ? 'Arnold V2 · iniciar sesión' : 'Demo local · Arnold V2 pendiente';
  return `<div class="app-shell"><aside class="sidebar"><div class="brand"><span class="brand-mark">↗</span><span>FitCoach<small class="brand-subtitle">Administración</small></span></div><nav class="nav">${navButton('dashboard', '⌂', 'Resumen')}${navButton('clients', '♙', 'Clientes')}${navButton('routines', '⌁', 'Rutinas')}${navButton('exercises', '◈', 'Ejercicios')}${navButton('progress', '◷', 'Progreso')}${navButton('settings', '⚙', 'Ajustes')}</nav><div class="sidebar-footer"><div class="connection"><strong><span class="online-dot ${navigator.onLine ? '' : 'offline-dot'}"></span>${navigator.onLine ? 'Con conexión' : 'Sin conexión'}</strong>${remoteLabel}</div></div></aside><main class="main">${content}</main></div>${state.modal || ''}${state.toast ? `<div class="statusbar">${escapeHtml(state.toast)}</div>` : ''}`;
}
function topbar(title, eyebrow, actions = '') { return `<header class="topbar"><div><p class="eyebrow">${eyebrow}</p><h1>${title}</h1></div><div class="top-actions">${actions}<div class="avatar">${isRemote() ? initials(state.remote.user?.email || 'A') : 'AD'}</div></div></header>`; }
function clientRow(client) { return `<button class="list-row" data-client="${client.id}"><span class="initials">${initials(client.full_name)}</span><span class="row-content"><strong>${escapeHtml(client.full_name)}</strong><p>${escapeHtml(client.goal || 'Sin objetivo definido')}</p></span><span class="pill ${statusClass(client.status)}">${textStatus(client.status)}</span></button>`; }

function dashboard() {
  const counts = ['active', 'expiring', 'expired'].map((status) => state.clients.filter((client) => client.status === status).length);
  const urgent = state.clients.find((client) => client.status === 'expiring');
  return shell(`${topbar('Resumen', 'Administración de FitCoach', `<button class="button" data-action="connect">${isRemote() ? 'Sincronizar' : 'Conectar Arnold V2'}</button><button class="button primary" data-action="new-client">+ Nuevo cliente</button>`)}<section class="grid-metrics"><button class="metric green" data-filter="active"><span class="metric-label">Clientes activos</span><span class="metric-value">${counts[0]}</span></button><button class="metric amber" data-filter="expiring"><span class="metric-label">Por revisar</span><span class="metric-value">${counts[1]}</span></button><button class="metric red" data-filter="expired"><span class="metric-label">Inactivos</span><span class="metric-value">${counts[2]}</span></button><button class="metric" data-filter="all"><span class="metric-label">Total de clientes</span><span class="metric-value">${state.clients.length}</span></button></section><section class="content-grid"><div class="card"><div class="card-header"><div><h2>Clientes recientes</h2><p>Expedientes y seguimiento, sin cobros recurrentes.</p></div><button class="button small" data-nav="clients">Ver todos</button></div><div class="list">${state.clients.slice(0, 5).map(clientRow).join('')}</div></div><div class="card"><div class="card-header"><div><h2>Atención del día</h2><p>Seguimiento operativo</p></div></div>${urgent ? `<div class="notice"><span>●</span><div><strong>${escapeHtml(urgent.full_name)}</strong><p>Su seguimiento requiere atención. Revisa su rutina y estado desde su expediente.</p></div></div>` : '<p class="muted">No hay clientes pendientes de revisión.</p>'}<div class="activity"><i class="activity-dot"></i><div><strong>Biblioteca disponible</strong><p>${state.exercises.length.toLocaleString('es-MX')} ejercicios guardados localmente.</p></div></div><div class="activity"><i class="activity-dot"></i><div><strong>Modo sin conexión</strong><p>Las consultas de ejercicios y los borradores siguen disponibles.</p></div></div><div class="activity"><i class="activity-dot"></i><div><strong>Sin pagos</strong><p>Este panel no incluye cobros, facturación ni mensualidades.</p></div></div></div></section>`);
}

function clientsPage() {
  const clients = state.clients.filter((client) => state.clientFilter === 'all' || client.status === state.clientFilter);
  return shell(`${topbar('Clientes', 'Expedientes y seguimiento', `<button class="button" data-action="connect">${isRemote() ? 'Sincronizar' : 'Conectar Arnold V2'}</button><button class="button primary" data-action="new-client">+ Nuevo cliente</button>`)}<section class="card"><div class="toolbar"><input class="field" id="client-search" placeholder="Buscar cliente..." /><select class="select" id="client-status"><option value="all">Todos los estados</option><option value="active">Activos</option><option value="expiring">Por revisar</option><option value="expired">Inactivos</option><option value="paused">Pausados</option></select><span class="muted" id="client-count">${clients.length} resultado(s)</span></div></section><section class="card"><div class="table-wrap"><table class="table"><thead><tr><th>Cliente</th><th>Contacto</th><th>Objetivo</th><th>Estado</th><th></th></tr></thead><tbody id="client-table">${clientsTable(clients)}</tbody></table></div></section>`);
}
function clientsTable(clients) { return clients.map((client) => `<tr><td><button class="link-button" data-client="${client.id}">${escapeHtml(client.full_name)}</button><br><span class="muted">${client.height_cm ? `${client.height_cm} cm` : 'Sin estatura'}</span></td><td>${escapeHtml(client.email || 'Sin correo')}<br><span class="muted">${escapeHtml(client.phone || 'Sin teléfono')}</span></td><td>${escapeHtml(client.goal || 'Sin objetivo')}</td><td><span class="pill ${statusClass(client.status)}">${textStatus(client.status)}</span></td><td><button class="button small" data-client="${client.id}">Abrir</button></td></tr>`).join('') || '<tr><td colspan="5" class="empty">No hay clientes con este filtro.</td></tr>'; }

function routinesPage() {
  return shell(`${topbar('Rutinas', 'Planes de entrenamiento', `<button class="button primary" data-action="new-routine">+ Crear rutina</button>`)}<section class="content-grid"><div class="card"><div class="card-header"><div><h2>Rutinas activas</h2><p>Asignadas a clientes y guardadas en Arnold V2 cuando hay conexión.</p></div></div><div class="list">${state.routines.map((routine) => { const client = state.clients.find((item) => String(item.id) === String(routine.client_id)); const exercises = routine.days.reduce((total, day) => total + day.exercises.length, 0); return `<button class="list-row" data-routine="${routine.id}"><span class="initials">⌁</span><span class="row-content"><strong>${escapeHtml(routine.name)}</strong><p>${escapeHtml(client?.full_name || 'Cliente sin asignar')} · ${routine.days.length || routine.days_per_week || 0} días · ${exercises} ejercicios</p></span><span class="pill active">Activa</span></button>`; }).join('') || '<p class="empty">Aún no hay rutinas activas.</p>'}</div></div><div class="card"><div class="card-header"><div><h2>Constructor</h2><p>Usa el catálogo local, incluso cuando no hay conexión.</p></div></div><p class="muted">Selecciona un cliente, define los días y agrega ejercicios. Si Arnold V2 no está disponible, se conservará un borrador local para sincronizar después.</p><button class="button primary" data-action="new-routine">Abrir constructor</button></div></section>`);
}

function exercisesPage() {
  const categories = [...new Set(state.exercises.map((exercise) => exercise.category).filter(Boolean))].sort();
  const visible = state.filteredExercises.slice(0, 60);
  return shell(`${topbar('Biblioteca de ejercicios', 'Catálogo local y sin conexión', `<button class="button" data-action="sync-catalog" ${isRemote() ? '' : 'disabled'}>Sincronizar seleccionados</button>`)}<section class="card"><div class="toolbar"><input class="field" id="exercise-search" value="${escapeHtml(state.exerciseSearch)}" placeholder="Buscar por ejercicio, músculo o equipo..." /><select class="select" id="exercise-category"><option value="all">Todas las categorías</option>${categories.map((category) => `<option value="${escapeHtml(category)}" ${state.exerciseCategory === category ? 'selected' : ''}>${escapeHtml(category)}</option>`).join('')}</select><span class="muted">${state.filteredExercises.length.toLocaleString('es-MX')} ejercicios disponibles localmente</span></div></section><section class="exercise-grid">${visible.map((exercise) => `<button class="exercise-card" data-exercise="${escapeHtml(exercise.id)}"><span class="exercise-visual">${exercise.image ? `<img loading="lazy" src="https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/${escapeHtml(exercise.image)}" alt="" onerror="this.remove()" />` : '↗'}</span><span class="exercise-content"><h3>${escapeHtml(exercise.name)}</h3><p>${escapeHtml(exercise.target || exercise.muscle_group || exercise.category || 'Ejercicio')} · ${escapeHtml(exercise.equipment || 'sin equipo')}</p></span></button>`).join('') || '<div class="empty">No encontramos ejercicios con esos filtros.</div>'}</section><p class="muted" style="margin-top:18px;font-size:12px">Datos e instrucciones: exercises-dataset. Las imágenes se muestran cuando hay conexión; el catálogo, instrucciones y constructor permanecen disponibles sin conexión. Ver <a href="./EXERCISES_NOTICE.md" target="_blank">aviso de atribución</a>.</p>`);
}

function progressPage() { return shell(`${topbar('Progreso', 'Seguimiento de clientes')}<section class="content-grid"><div class="card"><div class="card-header"><div><h2>Actividad reciente</h2><p>Resumen operativo de entrenamiento.</p></div></div>${state.clients.slice(0,5).map((client, index) => `<div class="activity"><i class="activity-dot"></i><div><strong>${escapeHtml(client.full_name)}</strong><p>${index % 2 ? 'Rutina pendiente de revisión.' : 'Expediente actualizado recientemente.'}</p></div></div>`).join('')}</div><div class="card"><div class="card-header"><div><h2>Indicadores</h2><p>Sin métricas de cobro.</p></div></div><div class="detail-list"><div class="detail-line"><span>Clientes activos</span><strong>${state.clients.filter((client) => client.status === 'active').length}</strong></div><div class="detail-line"><span>Rutinas activas</span><strong>${state.routines.length}</strong></div><div class="detail-line"><span>Ejercicios en catálogo</span><strong>${state.exercises.length.toLocaleString('es-MX')}</strong></div></div></div></section>`); }
function settingsPage() { return shell(`${topbar('Ajustes', 'Configuración del panel')}<section class="content-grid"><div class="card"><div class="card-header"><div><h2>Arnold V2</h2><p>Conexión exclusiva del panel web.</p></div></div><div class="detail-list"><div class="detail-line"><span>Estado</span><strong>${isRemote() ? 'Conectado' : state.remote.configured ? 'Listo para iniciar sesión' : 'Falta configuración'}</strong></div><div class="detail-line"><span>Modo sin conexión</span><strong>Biblioteca y borradores locales</strong></div><div class="detail-line"><span>Clave privada</span><strong>No se utiliza</strong></div><div class="detail-line"><span>Módulos de cobro</span><strong>No incluidos</strong></div></div><div class="form-actions"><button class="button primary" data-action="connect">${isRemote() ? 'Actualizar datos' : 'Conectar Arnold V2'}</button>${isRemote() ? '<button class="button danger" data-action="sign-out">Cerrar sesión</button>' : ''}</div></div><div class="card"><div class="card-header"><div><h2>Instalación sin conexión</h2><p>Disponible después de abrir el panel una vez.</p></div></div><p class="muted">El catálogo de 1,324 ejercicios se guarda en el navegador mediante el servicio local de la aplicación. Los datos sensibles no se copian como parte de este caché.</p></div></section>`); }

function clientModal(client) {
  const routine = state.routines.find((item) => String(item.client_id) === String(client.id));
  return `<div class="modal-backdrop" data-dismiss="true"><section class="modal" role="dialog" aria-modal="true"><div class="modal-header"><div><h2>${escapeHtml(client.full_name)}</h2><p>Expediente de cliente</p></div><button class="icon-button" data-close aria-label="Cerrar">×</button></div><div class="detail-columns"><div><div class="detail-list"><div class="detail-line"><span>Correo</span><strong>${escapeHtml(client.email || 'No registrado')}</strong></div><div class="detail-line"><span>Teléfono</span><strong>${escapeHtml(client.phone || 'No registrado')}</strong></div><div class="detail-line"><span>Objetivo</span><strong>${escapeHtml(client.goal || 'Sin definir')}</strong></div><div class="detail-line"><span>Estatura</span><strong>${client.height_cm ? `${client.height_cm} cm` : 'Sin registrar'}</strong></div><div class="detail-line"><span>Estado</span><strong>${textStatus(client.status)}</strong></div></div><h3 style="margin-top:19px">Notas del entrenador</h3><p class="muted">${escapeHtml(client.notes || 'Sin notas registradas.')}</p></div><div><h3>Rutina asignada</h3>${routine ? `<div class="routine-day"><strong>${escapeHtml(routine.name)}</strong><p class="muted">${routine.days.length} día(s) de entrenamiento</p>${routine.days.map((day) => `<div class="routine-day"><strong>${escapeHtml(day.label || dayName(day.day))}</strong><ol>${day.exercises.map((exercise) => `<li>${escapeHtml(exercise.name)}</li>`).join('') || '<li>Sin ejercicios</li>'}</ol></div>`).join('')}</div>` : '<p class="muted">No tiene una rutina asignada.</p>'}<button class="button primary" style="margin-top:12px" data-action="new-routine" data-client-id="${client.id}">Asignar rutina</button></div></div></section></div>`;
}

function newClientModal() { return `<div class="modal-backdrop" data-dismiss="true"><form class="modal" id="new-client-form"><div class="modal-header"><div><h2>Nuevo cliente</h2><p>Crear expediente sin planes de pago ni mensualidades.</p></div><button type="button" class="icon-button" data-close>×</button></div><div class="form-grid"><label>Nombre completo<input class="field" name="full_name" required /></label><label>Correo<input class="field" name="email" type="email" /></label><label>Teléfono<input class="field" name="phone" /></label><label>Estado<select class="select" name="status"><option value="active">Activo</option><option value="expiring">Por revisar</option><option value="paused">Pausado</option></select></label><label>Estatura (cm)<input class="field" name="height_cm" type="number" min="80" max="260" /></label><label>Objetivo<input class="field" name="goal" placeholder="Ej. ganar fuerza" /></label><label class="wide">Notas<textarea class="field" name="notes" rows="4" style="padding:10px"></textarea></label></div><div class="form-actions"><button type="button" class="button" data-close>Cancelar</button><button class="button primary">Guardar cliente</button></div></form></div>`; }

function routineModal(clientId = '') {
  const clientOptions = state.clients.map((client) => `<option value="${client.id}" ${String(client.id) === String(clientId) ? 'selected' : ''}>${escapeHtml(client.full_name)}</option>`).join('');
  return `<div class="modal-backdrop" data-dismiss="true"><form class="modal modal-wide" id="routine-form"><div class="modal-header"><div><h2>Constructor de rutina</h2><p>Elige ejercicios del catálogo local. Se guardará como borrador si no hay conexión.</p></div><button type="button" class="icon-button" data-close>×</button></div><div class="form-grid"><label>Nombre de rutina<input class="field" name="name" required placeholder="Ej. Fuerza base" /></label><label>Cliente<select class="select" name="client_id" required>${clientOptions}</select></label><label>Días<select class="select" name="days" multiple size="4"><option value="1" selected>Lunes</option><option value="2">Martes</option><option value="3" selected>Miércoles</option><option value="4">Jueves</option><option value="5" selected>Viernes</option><option value="6">Sábado</option></select></label><label>Duración estimada<select class="select" name="session_minutes"><option value="30">30 min</option><option value="45">45 min</option><option value="60" selected>60 min</option><option value="90">90 min</option></select></label></div><div class="builder-layout" style="margin-top:17px"><div><input class="field" id="builder-search" placeholder="Buscar ejercicio para agregar..." /><div class="list" id="builder-results" style="margin-top:10px;max-height:350px;overflow:auto"></div></div><div><h3>Ejercicios seleccionados</h3><div class="selected-exercises" id="selected-exercises"></div></div></div><div class="form-actions"><button type="button" class="button" data-close>Cancelar</button><button class="button primary">Guardar rutina</button></div></form></div>`;
}

function exerciseModal(exercise) {
  const steps = exercise.instruction_steps?.es || exercise.instructions?.es?.split(/\.\s+/).filter(Boolean) || ['Las instrucciones están disponibles al sincronizar el catálogo.'];
  return `<div class="modal-backdrop" data-dismiss="true"><section class="modal" role="dialog" aria-modal="true"><div class="modal-header"><div><h2>${escapeHtml(exercise.name)}</h2><p>${escapeHtml(exercise.target || exercise.muscle_group || exercise.category || '')} · ${escapeHtml(exercise.equipment || 'sin equipo')}</p></div><button class="icon-button" data-close>×</button></div><div class="detail-columns"><div><h3>Instrucciones</h3><ol class="muted" style="line-height:1.6">${steps.map((step) => `<li>${escapeHtml(step)}</li>`).join('')}</ol><p class="muted">Músculos secundarios: ${escapeHtml((exercise.secondary_muscles || []).join(', ') || 'No especificados')}</p></div><div><div class="exercise-visual" style="height:210px;border-radius:14px">${exercise.image ? `<img src="https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/${escapeHtml(exercise.image)}" alt="" onerror="this.remove()" />` : '↗'}</div><p class="muted" style="font-size:11px">Las imágenes de Gym visual se muestran cuando hay conexión y conservan su atribución.</p></div></div></section></div>`;
}

function loginModal() {
  return `<div class="modal-backdrop" data-dismiss="true"><form class="modal" id="login-form"><div class="modal-header"><div><h2>Conectar Arnold V2</h2><p>Inicia sesión con una cuenta de administrador o entrenador autorizada.</p></div><button type="button" class="icon-button" data-close>×</button></div>${state.remote.configured ? `<div class="form-stack"><label>Correo<input class="field" name="email" type="email" required autocomplete="email" /></label><label>Contraseña<input class="field" name="password" type="password" required autocomplete="current-password" /></label></div><div class="form-actions"><button type="button" class="button" data-close>Cancelar</button><button class="button primary">Ingresar</button></div>` : `<div class="status-banner warn">Falta la URL y la publishable key de Arnold V2. Copia <code>config.example.js</code> como <code>config.js</code> y agrega solamente las credenciales públicas de ese proyecto.</div><div class="form-actions"><button type="button" class="button" data-close>Entendido</button></div>`}</form></div>`;
}

function render() {
  const page = ({ dashboard, clients: clientsPage, routines: routinesPage, exercises: exercisesPage, progress: progressPage, settings: settingsPage }[state.view] || dashboard)();
  APP.innerHTML = page;
  bindEvents();
}

function bindEvents() {
  document.querySelectorAll('[data-nav]').forEach((button) => button.addEventListener('click', () => { state.view = button.dataset.nav; state.clientFilter = 'all'; render(); }));
  document.querySelectorAll('[data-filter]').forEach((button) => button.addEventListener('click', () => { state.view = 'clients'; state.clientFilter = button.dataset.filter; render(); }));
  document.querySelectorAll('[data-client]').forEach((button) => button.addEventListener('click', () => { const client = state.clients.find((item) => String(item.id) === String(button.dataset.client)); if (client) { state.modal = clientModal(client); render(); } }));
  document.querySelectorAll('[data-routine]').forEach((button) => button.addEventListener('click', () => { const routine = state.routines.find((item) => String(item.id) === String(button.dataset.routine)); if (routine) { const client = state.clients.find((item) => String(item.id) === String(routine.client_id)); state.modal = clientModal(client || { full_name: 'Cliente sin asignar', id: '' }); render(); } }));
  document.querySelectorAll('[data-exercise]').forEach((button) => button.addEventListener('click', () => { const exercise = state.exercises.find((item) => String(item.id) === String(button.dataset.exercise)); if (exercise) { state.modal = exerciseModal(exercise); render(); } }));
  document.querySelectorAll('[data-close]').forEach((button) => button.addEventListener('click', () => { state.modal = null; render(); }));
  document.querySelectorAll('[data-dismiss]').forEach((backdrop) => backdrop.addEventListener('click', (event) => { if (event.target === backdrop) { state.modal = null; render(); } }));
  document.querySelectorAll('[data-action]').forEach((button) => button.addEventListener('click', () => handleAction(button)));
  const clientSearch = document.querySelector('#client-search'); const clientStatus = document.querySelector('#client-status');
  if (clientSearch && clientStatus) {
    clientStatus.value = state.clientFilter;
    const updateClients = () => { const needle = clientSearch.value.toLowerCase(); state.clientFilter = clientStatus.value; const rows = state.clients.filter((client) => (state.clientFilter === 'all' || client.status === state.clientFilter) && client.full_name.toLowerCase().includes(needle)); document.querySelector('#client-table').innerHTML = clientsTable(rows); document.querySelector('#client-count').textContent = `${rows.length} resultado(s)`; bindEvents(); };
    clientSearch.addEventListener('input', updateClients); clientStatus.addEventListener('change', updateClients);
  }
  const exerciseSearch = document.querySelector('#exercise-search'); const exerciseCategory = document.querySelector('#exercise-category');
  if (exerciseSearch && exerciseCategory) { exerciseSearch.addEventListener('input', () => { state.exerciseSearch = exerciseSearch.value; applyExerciseFilter(); render(); }); exerciseCategory.addEventListener('change', () => { state.exerciseCategory = exerciseCategory.value; applyExerciseFilter(); render(); }); }
  document.querySelector('#new-client-form')?.addEventListener('submit', submitClient);
  document.querySelector('#login-form')?.addEventListener('submit', async (event) => { event.preventDefault(); try { await signIn(event.currentTarget); } catch (error) { toast(error.message); } });
  if (document.querySelector('#routine-form')) bindRoutineBuilder();
}

async function handleAction(button) {
  const action = button.dataset.action;
  if (action === 'new-client') { state.modal = newClientModal(); render(); }
  if (action === 'new-routine') { state.modal = routineModal(button.dataset.clientId); render(); }
  if (action === 'connect') { if (isRemote()) { try { await loadRemoteData(); toast('Datos de Arnold V2 actualizados.'); render(); } catch (error) { toast(error.message); } } else { state.modal = loginModal(); render(); } }
  if (action === 'sign-out') { localStorage.removeItem(SESSION_KEY); state.remote.session = null; state.remote.user = null; state.clients = structuredClone(demoClients); toast('Sesión cerrada. Estás en el modo local.'); render(); }
  if (action === 'sync-catalog') toast('El catálogo completo ya se consulta localmente. Los ejercicios de una rutina se sincronizan al guardarla.');
}

async function submitClient(event) {
  event.preventDefault();
  const values = Object.fromEntries(new FormData(event.currentTarget));
  const client = { id: `local-${Date.now()}`, full_name: values.full_name.trim(), email: values.email.trim() || null, phone: values.phone.trim() || null, status: values.status, goal: values.goal.trim() || null, height_cm: values.height_cm ? Number(values.height_cm) : null, notes: values.notes.trim() || null, created_at: new Date().toISOString() };
  try {
    if (isRemote()) {
      const created = await api('/rest/v1/fc_clients', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ ...client, id: undefined, trainer_id: state.remote.user?.id || state.remote.session.user?.id }) });
      client.id = created[0].id;
    } else queueDraft({ type: 'client', payload: client });
    state.clients.unshift(client); state.modal = null; toast(isRemote() ? 'Cliente guardado en Arnold V2.' : 'Cliente guardado como borrador local.'); render();
  } catch (error) { toast(error.message); }
}

function queueDraft(draft) { const drafts = JSON.parse(localStorage.getItem(DRAFTS_KEY) || '[]'); drafts.push({ ...draft, queuedAt: new Date().toISOString() }); localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts)); }

function bindRoutineBuilder() {
  const form = document.querySelector('#routine-form'); const search = document.querySelector('#builder-search'); const results = document.querySelector('#builder-results'); const selected = document.querySelector('#selected-exercises'); let selectedExercises = [];
  function refreshSelected() { selected.innerHTML = selectedExercises.map((exercise, index) => `<div class="selected-exercise"><span>${escapeHtml(exercise.name)}</span><button type="button" data-remove-exercise="${index}">Quitar</button></div>`).join('') || '<p class="muted">Aún no agregas ejercicios.</p>'; selected.querySelectorAll('[data-remove-exercise]').forEach((button) => button.addEventListener('click', () => { selectedExercises.splice(Number(button.dataset.removeExercise), 1); refreshSelected(); })); }
  function refreshResults() { const needle = search.value.trim().toLowerCase(); results.innerHTML = state.exercises.filter((exercise) => !needle || exercise.name.toLowerCase().includes(needle) || String(exercise.target || '').toLowerCase().includes(needle)).slice(0, 18).map((exercise) => `<button type="button" class="list-row" data-add-exercise="${escapeHtml(exercise.id)}"><span class="initials">+</span><span class="row-content"><strong>${escapeHtml(exercise.name)}</strong><p>${escapeHtml(exercise.target || exercise.category || '')} · ${escapeHtml(exercise.equipment || '')}</p></span></button>`).join(''); results.querySelectorAll('[data-add-exercise]').forEach((button) => button.addEventListener('click', () => { const exercise = state.exercises.find((item) => String(item.id) === String(button.dataset.addExercise)); if (exercise && !selectedExercises.some((item) => String(item.id) === String(exercise.id))) { selectedExercises.push(exercise); refreshSelected(); } })); }
  search.addEventListener('input', refreshResults); refreshResults(); refreshSelected();
  form.addEventListener('submit', async (event) => {
    event.preventDefault(); if (!selectedExercises.length) return toast('Agrega al menos un ejercicio.');
    const values = new FormData(form); const days = [...form.querySelector('[name=days]').selectedOptions].map((option) => Number(option.value));
    const routine = { id: `local-routine-${Date.now()}`, client_id: values.get('client_id'), name: values.get('name').trim(), session_minutes: Number(values.get('session_minutes')), days: days.map((day) => ({ day, exercises: selectedExercises.map((exercise) => ({ ...exercise, sets: 3, reps: '10-12' })) })) };
    try {
      if (isRemote()) await saveRoutineToRemote(routine); else queueDraft({ type: 'routine', payload: routine });
      state.routines.unshift(routine); state.modal = null; toast(isRemote() ? 'Rutina guardada en Arnold V2.' : 'Rutina guardada como borrador local.'); render();
    } catch (error) { toast(error.message); }
  });
}

async function saveRoutineToRemote(routine) {
  const userId = state.remote.user?.id || state.remote.session?.user?.id;
  const [created] = await api('/rest/v1/fc_routines', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ client_id: Number(routine.client_id), created_by: userId, name: routine.name, source: 'trainer', goal: 'general', experience_level: 'beginner', training_location: 'gym', focus_mode: 'balanced', priority_muscles: [], session_minutes: routine.session_minutes, days_per_week: routine.days.length, is_active: true }) });
  await api('/rest/v1/fc_routine_days', { method: 'POST', body: JSON.stringify(routine.days.map((day) => ({ routine_id: created.id, day_of_week: day.day, label: dayName(day.day) }))) });
  const savedExercises = [];
  for (const exercise of routine.days[0].exercises) {
    const [saved] = await api('/rest/v1/fc_exercises?on_conflict=name', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=representation' }, body: JSON.stringify({ name: exercise.name, muscle_group: exercise.target || exercise.muscle_group || exercise.category || 'general', secondary_muscles: exercise.secondary_muscles || [], difficulty: 'beginner', exercise_type: exercise.category === 'cardio' ? 'cardio' : 'compound', instructions: exercise.instruction_steps?.es || [], coaching_tip: exercise.equipment ? `Equipo: ${exercise.equipment}` : null, is_active: true }) });
    savedExercises.push({ sourceId: exercise.id, id: saved.id });
  }
  const lookup = new Map(savedExercises.map((item) => [String(item.sourceId), item.id]));
  await api('/rest/v1/fc_routine_exercises', { method: 'POST', body: JSON.stringify(routine.days.flatMap((day) => day.exercises.map((exercise, index) => ({ routine_id: created.id, exercise_id: lookup.get(String(exercise.id)), day_of_week: day.day, order_index: index + 1, sets: exercise.sets || 3, reps_min: 10, reps_max: 12, rest_seconds: 90 })))) });
  routine.id = created.id;
}

window.addEventListener('online', () => { toast('Conexión restablecida.'); render(); });
window.addEventListener('offline', () => { toast('Modo sin conexión activado.'); render(); });
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
render();
loadExercises();
if (hasRemoteSession()) loadRemoteData().then(() => { toast('Arnold V2 conectado.'); render(); }).catch(() => { localStorage.removeItem(SESSION_KEY); state.remote.session = null; render(); });
