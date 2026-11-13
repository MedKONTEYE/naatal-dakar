import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit, Trash2, Eye, Filter, Lock } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useDataSync } from '../context/DataSyncContext';

const Interventions = () => {
  const { can } = useAuth();
  const { revision, notifyChange } = useDataSync();
  const canWrite = can('operations.write');
  const canDelete = can('operations.delete');
  const [interventions, setInterventions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('create');
  const [selectedIntervention, setSelectedIntervention] = useState(null);
  const [filters, setFilters] = useState({ search: '', pilier: 'all', statut: 'all' });
  const [formData, setFormData] = useState({
    titre: '', description: '', pilier: 'reverdissement', quartier: '', 
    date: '', responsable: '', statut: 'planifiee', 
    objectifs: {}, realisations: {}
  });

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        const response = await axios.get('/api/interventions');
        if (!cancelled) setInterventions(response.data.data || []);
      } catch (err) {
        if (!cancelled) console.error(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [revision]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (modalMode === 'create') {
        await axios.post('/api/interventions', formData);
        alert('Intervention créée avec succès');
      } else if (modalMode === 'edit') {
        await axios.put(`/api/interventions/${selectedIntervention.id}`, formData);
        alert('Intervention mise à jour avec succès');
      }
      setShowModal(false);
      resetForm();
      notifyChange();
    } catch (err) {
      alert(err.response?.data?.message || 'Erreur lors de l\'enregistrement');
      console.error(err);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer cette intervention ?')) {
      try {
        await axios.delete(`/api/interventions/${id}`);
        alert('Intervention supprimée');
        notifyChange();
      } catch (err) {
        alert(err.response?.data?.message || 'Erreur lors de la suppression');
        console.error(err);
      }
    }
  };

  const openModal = (mode, intervention = null) => {
    setModalMode(mode);
    if (intervention) {
      setSelectedIntervention(intervention);
      setFormData({
        titre: intervention.titre,
        description: intervention.description,
        pilier: intervention.pilier,
        quartier: intervention.quartier,
        date: intervention.date,
        responsable: intervention.responsable,
        statut: intervention.statut,
        objectifs: intervention.objectifs || {},
        realisations: intervention.realisations || {}
      });
    } else {
      resetForm();
    }
    setShowModal(true);
  };

  const resetForm = () => {
    setSelectedIntervention(null);
    setFormData({
      titre: '', description: '', pilier: 'reverdissement', quartier: '', 
      date: '', responsable: '', statut: 'planifiee', 
      objectifs: {}, realisations: {}
    });
  };

  const filteredInterventions = interventions.filter(i => {
    const matchSearch = filters.search === '' || 
      i.titre.toLowerCase().includes(filters.search.toLowerCase()) ||
      i.quartier.toLowerCase().includes(filters.search.toLowerCase());
    const matchPilier = filters.pilier === 'all' || i.pilier === filters.pilier;
    const matchStatut = filters.statut === 'all' || i.statut === filters.statut;
    return matchSearch && matchPilier && matchStatut;
  });

  const getPilierLabel = (pilier) => {
    if (pilier === 'reverdissement') return 'Reverdissement';
    if (pilier === 'salubrite') return 'Salubrité';
    if (pilier === 'mobilisation') return 'Mobilisation citoyenne';
    return pilier;
  };

  const getStatutLabel = (statut) => {
    if (statut === 'terminee') return 'Terminée';
    if (statut === 'en_cours') return 'En cours';
    if (statut === 'planifiee') return 'Planifiée';
    if (statut === 'annulee') return 'Annulée';
    return statut;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestion des interventions</h1>
          <p className="text-gray-600 mt-1">
            Consulter, ajouter, modifier et supprimer les interventions
            {canWrite ? ' • Mode édition' : ' • Lecture seule'}
          </p>
        </div>
        {canWrite ? (
          <button
            onClick={() => openModal('create')}
            className="flex items-center gap-2 px-4 py-2 bg-naatal-green text-white rounded-lg hover:bg-naatal-green-dark transition-colors"
          >
            <Plus size={18} />
            <span>Ajouter une intervention</span>
          </button>
        ) : (
          <span className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm">
            <Lock size={16} />
            Connexion requise pour modifier
          </span>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl p-4 card-shadow border border-gray-100">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher par nom ou quartier..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-naatal-green"
            />
          </div>
          <select
            value={filters.pilier}
            onChange={(e) => setFilters({ ...filters, pilier: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-naatal-green"
          >
            <option value="all">Tous les piliers</option>
            <option value="reverdissement">Reverdissement</option>
            <option value="salubrite">Salubrité</option>
            <option value="mobilisation">Mobilisation citoyenne</option>
          </select>
          <select
            value={filters.statut}
            onChange={(e) => setFilters({ ...filters, statut: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-naatal-green"
          >
            <option value="all">Tous les statuts</option>
            <option value="planifiee">Planifiée</option>
            <option value="en_cours">En cours</option>
            <option value="terminee">Terminée</option>
            <option value="annulee">Annulée</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl card-shadow border border-gray-100 overflow-hidden">
        {loading && interventions.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-naatal-green"></div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Intervention</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pilier</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quartier</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Responsable</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Statut</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredInterventions.map((intervention) => (
                  <tr key={intervention.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium text-gray-900">{intervention.titre}</p>
                        <p className="text-sm text-gray-500">{intervention.id}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        intervention.pilier === 'reverdissement' ? 'bg-naatal-green-light text-naatal-green-dark' :
                        intervention.pilier === 'salubrite' ? 'bg-blue-50 text-blue-700' :
                        'bg-purple-50 text-purple-700'
                      }`}>
                        {getPilierLabel(intervention.pilier)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">{intervention.quartier}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{intervention.date}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{intervention.responsable}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        intervention.statut === 'terminee' ? 'bg-green-100 text-green-700' :
                        intervention.statut === 'en_cours' ? 'bg-blue-100 text-blue-700' :
                        intervention.statut === 'planifiee' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {getStatutLabel(intervention.statut)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openModal('view', intervention)}
                          className="p-1 text-gray-600 hover:text-naatal-green"
                          title="Voir détails"
                        >
                          <Eye size={18} />
                        </button>
                        <button
                          onClick={() => openModal('edit', intervention)}
                          className="p-1 text-gray-600 hover:text-blue-600"
                          title="Modifier"
                          disabled={!canWrite}
                        >
                          <Edit size={18} />
                        </button>
                        <button
                          onClick={() => handleDelete(intervention.id)}
                          className="p-1 text-gray-600 hover:text-red-600 disabled:opacity-40 disabled:cursor-not-allowed"
                          title="Supprimer"
                          disabled={!canDelete}
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">
                {modalMode === 'create' ? 'Ajouter une intervention' :
                 modalMode === 'edit' ? 'Modifier l\'intervention' :
                 'Détails de l\'intervention'}
              </h2>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Titre *</label>
                  <input
                    type="text"
                    required
                    disabled={modalMode === 'view'}
                    value={formData.titre}
                    onChange={(e) => setFormData({ ...formData, titre: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-naatal-green disabled:bg-gray-50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Quartier *</label>
                  <input
                    type="text"
                    required
                    disabled={modalMode === 'view'}
                    value={formData.quartier}
                    onChange={(e) => setFormData({ ...formData, quartier: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-naatal-green disabled:bg-gray-50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Pilier *</label>
                  <select
                    required
                    disabled={modalMode === 'view'}
                    value={formData.pilier}
                    onChange={(e) => setFormData({ ...formData, pilier: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-naatal-green disabled:bg-gray-50"
                  >
                    <option value="reverdissement">Reverdissement</option>
                    <option value="salubrite">Salubrité</option>
                    <option value="mobilisation">Mobilisation citoyenne</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
                  <input
                    type="date"
                    required
                    disabled={modalMode === 'view'}
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-naatal-green disabled:bg-gray-50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Responsable</label>
                  <input
                    type="text"
                    disabled={modalMode === 'view'}
                    value={formData.responsable}
                    onChange={(e) => setFormData({ ...formData, responsable: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-naatal-green disabled:bg-gray-50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Statut</label>
                  <select
                    disabled={modalMode === 'view'}
                    value={formData.statut}
                    onChange={(e) => setFormData({ ...formData, statut: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-naatal-green disabled:bg-gray-50"
                  >
                    <option value="planifiee">Planifiée</option>
                    <option value="en_cours">En cours</option>
                    <option value="terminee">Terminée</option>
                    <option value="annulee">Annulée</option>
                  </select>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  rows={3}
                  disabled={modalMode === 'view'}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-naatal-green disabled:bg-gray-50"
                />
              </div>
              
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  {modalMode === 'view' ? 'Fermer' : 'Annuler'}
                </button>
                {modalMode !== 'view' && (
                  <button
                    type="submit"
                    className="px-4 py-2 bg-naatal-green text-white rounded-lg hover:bg-naatal-green-dark"
                  >
                    {modalMode === 'create' ? 'Créer' : 'Enregistrer'}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Interventions;
