export const EXERCISE_MEDIA_BASE = 'https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/';

export function initials(name = '') {
  return name.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase() || 'FC';
}

// Estados de fc_clients en Arnold V2.
export function textStatus(status) {
  return ({ active: 'Activo', invited: 'Invitado', paused: 'Pausado', archived: 'Archivado' }[status] || status);
}

export function statusClass(status) {
  return status === 'active' ? 'active' : status === 'invited' ? 'expiring' : status === 'paused' ? 'expired' : 'neutral';
}

// Arnold V2: 1 = Lunes … 7 = Domingo (0 también se lee como domingo).
export function dayName(day) {
  return ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'][day] || 'Día';
}

export function exerciseSubtitle(exercise) {
  return `${exercise.target || exercise.muscle_group || exercise.category || 'Ejercicio'} · ${exercise.equipment || 'sin equipo'}`;
}

export function exerciseSteps(exercise) {
  return exercise.instruction_steps?.es
    || exercise.instructions?.es?.split(/\.\s+/).filter(Boolean)
    || ['Las instrucciones están disponibles al sincronizar el catálogo.'];
}
