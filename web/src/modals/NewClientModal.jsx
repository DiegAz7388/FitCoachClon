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
      status: values.status,
      goal: values.goal.trim() || null,
      height_cm: values.height_cm ? Number(values.height_cm) : null,
      notes: values.notes.trim() || null,
      created_at: new Date().toISOString(),
    };
    try { await addClient(client); } catch (error) { toast(error.message); }
  }
  return (
    <Modal as="form" title="Nuevo cliente" subtitle="Crear expediente sin planes de pago ni mensualidades." onSubmit={handleSubmit}>
      <div className="form-grid">
        <label>Nombre completo<input className="field" name="full_name" required /></label>
        <label>Correo<input className="field" name="email" type="email" /></label>
        <label>Teléfono<input className="field" name="phone" /></label>
        <label>Estado
          <select className="select" name="status" defaultValue="active">
            <option value="active">Activo</option>
            <option value="expiring">Por revisar</option>
            <option value="paused">Pausado</option>
          </select>
        </label>
        <label>Estatura (cm)<input className="field" name="height_cm" type="number" min="80" max="260" /></label>
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
