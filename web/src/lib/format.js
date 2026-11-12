export const EXERCISE_MEDIA_BASE = 'https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/';

export function initials(name = '') {
  return name.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase() || 'FC';
}

export function textStatus(status) {
  return ({ active: 'Activo', expiring: 'Por vencer', expired: 'Inactivo', paused: 'Pausado' }[status] || status);
}

export function statusClass(status) {
  return status === 'active' ? 'active' : status === 'expiring' ? 'expiring' : status === 'expired' ? 'expired' : 'neutral';
}

export function dayName(day) {
  return ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][day] || 'Día';
}

export function exerciseSubtitle(exercise) {
  return `${exercise.target || exercise.muscle_group || exercise.category || 'Ejercicio'} · ${exercise.equipment || 'sin equipo'}`;
}

export function exerciseSteps(exercise) {
  return exercise.instruction_steps?.es
    || exercise.instructions?.es?.split(/\.\s+/).filter(Boolean)
    || ['Las instrucciones están disponibles al sincronizar el catálogo.'];
}
