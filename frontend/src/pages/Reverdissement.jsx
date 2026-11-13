import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { TreePine, QrCode, Plus, Pencil, Trash2, Lock } from 'lucide-react';
import axios from 'axios';
import Modal from '../components/Modal';
import { useAuth } from '../context/AuthContext';
import { useDataSync } from '../context/DataSyncContext';

const inputClass =
  'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-naatal-green disabled:bg-gray-50';

const ENTRETIEN_LABELS = {
  a_faire: 'À faire',
  en_cours: 'En cours',
  termine: 'Terminé'
};

const ENTRETIEN_STYLES = {
  a_faire: 'bg-yellow-100 text-yellow-700',
  en_cours: 'bg-blue-100 text-blue-700',
  termine: 'bg-green-100 text-green-700'
};

const emptyForm = {
  site: '',
  espece: '',
  arbresPlantes: '',
  arbresSurvivants: '',
  arbresNonSurvivants: '',
  datePlantation: '',
  responsable: '',
  entretien: 'a_faire'
};

const Field = ({ label, htmlFor, hint, className = '', children }) => (
  <div className={className}>
    <label htmlFor={htmlFor} className="block text-sm font-medium text-gray-700 mb-1">
      {label}
    </label>
    {children}
    {hint && <p className="text-xs text-gray-500 mt-1">{hint}</p>}
  </div>
);

const Reverdissement = () => {
  const { can } = useAuth();
  const { revision, notifyChange } = useDataSync();
  const canWrite = can('operations.write');
  const canDelete = can('operations.delete');
  const showActions = canWrite || canDelete;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      try {
        const response = await axios.get('/api/trees');
        if (!cancelled) setData(response.data);
      } catch (err) {
        if (!cancelled) console.error(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchData();

    return () => {
      cancelled = true;
    };
  }, [revision]);

  useEffect(() => {
    if (!feedback) return undefined;
    const timer = setTimeout(() => setFeedback(null), 6000);
    return () => clearTimeout(timer);
  }, [feedback]);

  const sitesConnus = useMemo(
    () => [...new Set((data?.plantations || []).map((p) => p.site).filter(Boolean))],
    [data]
  );

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm, datePlantation: new Date().toISOString().slice(0, 10) });
    setFormError('');
    setModalOpen(true);
  };

  const openEdit = (plantation) => {
    setEditing(plantation);
    setForm({
      site: plantation.site || '',
      espece: plantation.espece || '',
      arbresPlantes: String(plantation.arbresPlantes ?? ''),
      arbresSurvivants: String(plantation.arbresSurvivants ?? ''),
      arbresNonSurvivants: String(plantation.arbresNonSurvivants ?? ''),
      datePlantation: plantation.datePlantation || '',
      responsable: plantation.responsable || '',
      entretien: plantation.entretien || 'a_faire'
    });
    setFormError('');
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
    setEditing(null);
    setFormError('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError('');

    const arbresPlantes = Number(form.arbresPlantes);
    const arbresSurvivants = Number(form.arbresSurvivants || 0);
    const arbresNonSurvivants = Number(form.arbresNonSurvivants || 0);

    if (!form.site.trim()) {
      setFormError('Le site (ville) est obligatoire.');
      return;
    }
    if (!Number.isInteger(arbresPlantes) || arbresPlantes < 0) {
      setFormError('Le nombre d’arbres plantés doit être un entier positif.');
      return;
    }
    if (
      !Number.isInteger(arbresSurvivants) ||
      arbresSurvivants < 0 ||
      !Number.isInteger(arbresNonSurvivants) ||
      arbresNonSurvivants < 0
    ) {
      setFormError('Les nombres de survivants et de non survivants doivent être des entiers positifs.');
      return;
    }
    if (arbresSurvivants + arbresNonSurvivants > arbresPlantes) {
      setFormError(
        'La somme des arbres survivants et non survivants ne peut pas dépasser le nombre d’arbres plantés.'
      );
      return;
    }

    const payload = {
      site: form.site,
      espece: form.espece,
      arbresPlantes,
      arbresSurvivants,
      arbresNonSurvivants,
      datePlantation: form.datePlantation,
      responsable: form.responsable,
      entretien: form.entretien
    };

    setSaving(true);
    try {
      if (editing) {
        await axios.put(`/api/trees/${editing.id}`, payload);
      } else {
        await axios.post('/api/trees', payload);
      }
      setModalOpen(false);
      setEditing(null);
      setFeedback({
        type: 'success',
        text: editing ? 'Opération de plantation mise à jour.' : 'Opération de plantation ajoutée.'
      });
      notifyChange();
    } catch (err) {
      setFormError(
        err.response?.data?.message || 'Impossible d’enregistrer cette opération de plantation.'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (plantation) => {
    if (!window.confirm(`Supprimer l’opération de plantation « ${plantation.site} » ?`)) {
      return;
    }

    setDeletingId(plantation.id);
    try {
      await axios.delete(`/api/trees/${plantation.id}`);
      setFeedback({ type: 'success', text: 'Opération de plantation supprimée.' });
      notifyChange();
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err.response?.data?.message || 'Impossible de supprimer cette opération de plantation.'
      });
    } finally {
      setDeletingId(null);
    }
  };

  if (loading && !data) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-naatal-green"></div></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reverdissement</h1>
          <p className="text-gray-600 mt-1">Suivi des plantations et du taux de survie • Données synchronisées avec la base</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canWrite ? (
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-2 px-4 py-2 bg-naatal-green text-white rounded-lg text-sm font-medium hover:bg-naatal-green-dark transition-colors"
            >
              <Plus size={18} />
              Ajouter une plantation
            </button>
          ) : (
            <span className="inline-flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm">
              <Lock size={16} />
              Lecture seule
            </span>
          )}
          <Link
            to="/scan-arbre"
            className="inline-flex items-center gap-2 px-4 py-2 border border-naatal-green text-naatal-green rounded-lg text-sm font-medium hover:bg-naatal-green-light transition-colors"
          >
            <QrCode size={18} />
            Scanner un arbre
          </Link>
        </div>
      </div>

      {feedback && (
        <p
          className={`text-sm rounded-lg p-3 border ${
            feedback.type === 'error'
              ? 'text-red-700 bg-red-50 border-red-200'
              : 'text-green-700 bg-green-50 border-green-200'
          }`}
        >
          {feedback.text}
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-5 card-shadow border border-gray-100">
          <TreePine className="text-naatal-green mb-2" size={24} />
          <p className="text-2xl font-bold text-gray-900">{data?.stats?.arbresPlantes || 0}</p>
          <p className="text-sm text-gray-600">Arbres plantés</p>
        </div>
        <div className="bg-white rounded-xl p-5 card-shadow border border-gray-100">
          <p className="text-2xl font-bold text-gray-900">{data?.stats?.sites || 0}</p>
          <p className="text-sm text-gray-600">Sites de plantation</p>
        </div>
        <div className="bg-white rounded-xl p-5 card-shadow border border-gray-100">
          <p className="text-2xl font-bold text-green-600">{data?.stats?.arbresSurvivants || 0}</p>
          <p className="text-sm text-gray-600">Arbres survivants</p>
        </div>
        <div className="bg-white rounded-xl p-5 card-shadow border border-gray-100">
          <p className="text-2xl font-bold text-naatal-green">{data?.stats?.tauxSurvie || 0}%</p>
          <p className="text-sm text-gray-600">Taux de survie</p>
          <p className="text-xs text-gray-500 mt-1">{data?.stats?.periodeMesure}</p>
        </div>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <p className="text-sm text-yellow-800">{data?.stats?.note}</p>
      </div>

      <div className="bg-white rounded-xl card-shadow border border-gray-100 overflow-hidden">
        <div className="p-5 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Opérations de plantation</h2>
          <p className="text-xs text-gray-500 mt-1">
            Ajoutez, modifiez ou supprimez les villes/sites et leurs valeurs. Chaque changement est visible partout.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Site</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Espèces</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Arbres plantés</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Survivants</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Non survivants</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Entretien</th>
                {showActions && (
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {(data?.plantations || []).length === 0 ? (
                <tr>
                  <td colSpan={showActions ? 8 : 7} className="px-6 py-10 text-center text-sm text-gray-500">
                    Aucune opération de plantation enregistrée.
                    {canWrite ? ' Utilisez « Ajouter une plantation » pour commencer.' : ''}
                  </td>
                </tr>
              ) : (
                data.plantations.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{p.site}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{p.espece}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{p.arbresPlantes}</td>
                    <td className="px-6 py-4 text-sm text-green-600">{p.arbresSurvivants}</td>
                    <td className="px-6 py-4 text-sm text-red-600">{p.arbresNonSurvivants}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{p.datePlantation || '—'}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs ${ENTRETIEN_STYLES[p.entretien] || 'bg-gray-100 text-gray-700'}`}>
                        {ENTRETIEN_LABELS[p.entretien] || p.entretien}
                      </span>
                    </td>
                    {showActions && (
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-1">
                          {canWrite && (
                            <button
                              type="button"
                              onClick={() => openEdit(p)}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Modifier"
                              aria-label={`Modifier ${p.site}`}
                            >
                              <Pencil size={16} />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => handleDelete(p)}
                              disabled={deletingId === p.id}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40"
                              title="Supprimer"
                              aria-label={`Supprimer ${p.site}`}
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={modalOpen}
        title={editing ? 'Modifier l’opération de plantation' : 'Ajouter une opération de plantation'}
        subtitle="Les indicateurs du tableau de bord et des rapports sont mis à jour immédiatement."
        onClose={closeModal}
        size="lg"
        footer={
          <>
            <button
              type="button"
              onClick={closeModal}
              disabled={saving}
              className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-60"
            >
              Annuler
            </button>
            <button
              type="submit"
              form="plantation-form"
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-naatal-green text-white font-medium hover:bg-naatal-green-dark disabled:opacity-60"
            >
              {saving ? 'Enregistrement...' : editing ? 'Mettre à jour' : 'Ajouter'}
            </button>
          </>
        }
      >
        <form id="plantation-form" onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Ville / Site" htmlFor="plantation-site" className="sm:col-span-2">
              <input
                id="plantation-site"
                type="text"
                list="sites-plantation"
                required
                minLength={2}
                maxLength={255}
                value={form.site}
                onChange={(event) => setForm({ ...form, site: event.target.value })}
                className={inputClass}
                placeholder="Ex. Medina - Place communale"
              />
              <datalist id="sites-plantation">
                {sitesConnus.map((site) => (
                  <option key={site} value={site} />
                ))}
              </datalist>
            </Field>

            <Field label="Espèces" htmlFor="plantation-espece">
              <input
                id="plantation-espece"
                type="text"
                maxLength={255}
                value={form.espece}
                onChange={(event) => setForm({ ...form, espece: event.target.value })}
                className={inputClass}
                placeholder="Ex. Neem, Cassia"
              />
            </Field>

            <Field label="Date de plantation" htmlFor="plantation-date">
              <input
                id="plantation-date"
                type="date"
                required
                value={form.datePlantation}
                onChange={(event) => setForm({ ...form, datePlantation: event.target.value })}
                className={inputClass}
              />
            </Field>

            <Field label="Arbres plantés *" htmlFor="plantation-plantes">
              <input
                id="plantation-plantes"
                type="number"
                min="0"
                max="1000000"
                step="1"
                required
                value={form.arbresPlantes}
                onChange={(event) => setForm({ ...form, arbresPlantes: event.target.value })}
                className={inputClass}
              />
            </Field>

            <Field label="Arbres survivants" htmlFor="plantation-survivants">
              <input
                id="plantation-survivants"
                type="number"
                min="0"
                max="1000000"
                step="1"
                value={form.arbresSurvivants}
                onChange={(event) => setForm({ ...form, arbresSurvivants: event.target.value })}
                className={inputClass}
              />
            </Field>

            <Field label="Arbres non survivants" htmlFor="plantation-non-survivants">
              <input
                id="plantation-non-survivants"
                type="number"
                min="0"
                max="1000000"
                step="1"
                value={form.arbresNonSurvivants}
                onChange={(event) => setForm({ ...form, arbresNonSurvivants: event.target.value })}
                className={inputClass}
              />
            </Field>

            <Field label="Entretien" htmlFor="plantation-entretien">
              <select
                id="plantation-entretien"
                value={form.entretien}
                onChange={(event) => setForm({ ...form, entretien: event.target.value })}
                className={inputClass}
              >
                <option value="a_faire">À faire</option>
                <option value="en_cours">En cours</option>
                <option value="termine">Terminé</option>
              </select>
            </Field>

            <Field label="Responsable" htmlFor="plantation-responsable" className="sm:col-span-2">
              <input
                id="plantation-responsable"
                type="text"
                maxLength={150}
                value={form.responsable}
                onChange={(event) => setForm({ ...form, responsable: event.target.value })}
                className={inputClass}
                placeholder="Ex. Equipe Verte Medina"
              />
            </Field>
          </div>

          <p className="text-xs text-gray-500">
            Survivants + non survivants ne peuvent pas dépasser le nombre d’arbres plantés.
          </p>

          {formError && (
            <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
              {formError}
            </p>
          )}
        </form>
      </Modal>
    </div>
  );
};

export default Reverdissement;
