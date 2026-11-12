import { Modal } from '../components/common.jsx';
import { useFitCoach } from '../state.jsx';

export default function NewClientModal() {
  const { addClient, closeModal, toast } = useFitCoach();
  async function handleSubmit(event) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const client = {
      id: `local-${Date.now()}`,
      full_name: values.full_name.trim(),
      email: values.email.trim() || null,
      phone: values.phone.trim() || null,
      // Arnold V2: con correo queda 'invited' hasta que el paciente active la app.
      status: values.email.trim() ? 'invited' : 'active',
      birth_date: values.birth_date || null,
      goal: values.goal.trim() || null,
      height_cm: values.height_cm ? Number(values.height_cm) : null,
      notes: values.notes.trim() || null,
      created_at: new Date().toISOString(),
    };
    try { await addClient(client); } catch (error) { toast(error.message); }
  }
  return (
    <Modal as="form" title="Nuevo cliente" subtitle="Con su correo, el paciente podrá activar la app de entrenamiento." onSubmit={handleSubmit}>
      <div className="form-grid">
        <label>Nombre completo<input className="field" name="full_name" required /></label>
        <label>Correo<input className="field" name="email" type="email" /></label>
        <label>Teléfono<input className="field" name="phone" /></label>
        <label>Fecha de nacimiento<input className="field" name="birth_date" type="date" /></label>
        <label>Estatura (cm)<input className="field" name="height_cm" type="number" min="50" max="280" step="0.1" /></label>
        <label>Objetivo<input className="field" name="goal" placeholder="Ej. ganar fuerza" /></label>
        <label className="wide">Notas<textarea className="field" name="notes" rows="4" style={{ padding: 10 }} /></label>
      </div>
      <div className="form-actions">
        <button type="button" className="button" onClick={closeModal}>Cancelar</button>
        <button className="button primary">Guardar cliente</button>
      </div>
    </Modal>
  );
}
