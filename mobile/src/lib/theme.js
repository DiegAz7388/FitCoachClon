// Mismos colores que el panel web (web/src/styles.css).
export const colors = {
  bg: '#09110c', surface: '#111b15', surface2: '#17231b', surface3: '#203326', border: '#2b4232',
  text: '#f3f7f2', muted: '#9ba99f', green: '#76dc58', greenDeep: '#153e20', amber: '#f0be4d', red: '#f06b5f',
};
export const radius = { sm: 10, md: 14, lg: 20, pill: 999 };
export const font = { h1: 30, h2: 20, h3: 16, body: 15, small: 13, tiny: 11 };
// Arnold V2 usa day_of_week 1–7 (1 = Lunes … 7 = Domingo). El índice 0 también es domingo por compatibilidad.
export const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
export const DAY_SHORT = ['D', 'L', 'M', 'M', 'J', 'V', 'S', 'D'];
export const WEEK = [1, 2, 3, 4, 5, 6, 7];
// Día de la semana en formato Arnold V2 (lunes = 1 … domingo = 7).
export const isoDay = (date = new Date()) => new Date(date).getDay() || 7;
