import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Filter, MapPin, X } from 'lucide-react';
import axios from 'axios';
import { useDataSync } from '../context/DataSyncContext';

// Fix for default markers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom icons
const greenIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const blueIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const violetIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-violet.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const Carte = () => {
  const [interventions, setInterventions] = useState([]);
  const [filteredInterventions, setFilteredInterventions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ type: 'all', statut: 'all' });
  const [mapOpen, setMapOpen] = useState(true);
  const { revision } = useDataSync();

  useEffect(() => {
    let cancelled = false;

    const fetchInterventions = async () => {
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

    fetchInterventions();

    return () => {
      cancelled = true;
    };
  }, [revision]);

  useEffect(() => {
    applyFilters();
  }, [interventions, filters]);

  const applyFilters = () => {
    let result = [...interventions];
    if (filters.type !== 'all') {
      result = result.filter(i => i.pilier === filters.type);
    }
    if (filters.statut !== 'all') {
      result = result.filter(i => i.statut === filters.statut);
    }
    setFilteredInterventions(result);
  };

  const getIcon = (pilier) => {
    if (pilier === 'reverdissement') return greenIcon;
    if (pilier === 'salubrite') return blueIcon;
    if (pilier === 'mobilisation') return violetIcon;
    return greenIcon;
  };

  const getTypeLabel = (pilier) => {
    if (pilier === 'reverdissement') return 'Plantation';
    if (pilier === 'salubrite') return 'Nettoyage';
    if (pilier === 'mobilisation') return 'Sensibilisation';
    return pilier;
  };

  const getStatusLabel = (statut) => {
    if (statut === 'terminee') return 'Terminée';
    if (statut === 'en_cours') return 'En cours';
    if (statut === 'planifiee') return 'Planifiée';
    if (statut === 'annulee') return 'Annulée';
    return statut;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Carte des interventions</h1>
          <p className="text-gray-600 mt-1">Localisation des actions à Dakar • Données synchronisées avec la base</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl p-4 card-shadow border border-gray-100">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter size={18} className="text-gray-600" />
            <span className="text-sm font-medium text-gray-700">Filtres</span>
          </div>
          <select
            value={filters.type}
            onChange={(e) => setFilters({ ...filters, type: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-naatal-green"
          >
            <option value="all">Tous les types</option>
            <option value="reverdissement">Plantation (Reverdissement)</option>
            <option value="salubrite">Nettoyage (Salubrité)</option>
            <option value="mobilisation">Sensibilisation (Mobilisation)</option>
          </select>
          <select
            value={filters.statut}
            onChange={(e) => setFilters({ ...filters, statut: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-naatal-green"
          >
            <option value="all">Tous les statuts</option>
            <option value="planifiee">Planifiée</option>
            <option value="en_cours">En cours</option>
            <option value="terminee">Terminée</option>
            <option value="annulee">Annulée</option>
          </select>
          <span className="text-sm text-gray-600">
            {filteredInterventions.length} intervention(s) affichée(s)
          </span>
        </div>
      </div>

      {/* Legend */}
      <div className="bg-white rounded-xl p-4 card-shadow border border-gray-100">
        <div className="flex flex-wrap items-center gap-6">
          <span className="text-sm font-medium text-gray-700">Légende :</span>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-green-600"></div>
            <span className="text-sm text-gray-600">Opérations de plantation</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-blue-600"></div>
            <span className="text-sm text-gray-600">Opérations de nettoyage</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-purple-600"></div>
            <span className="text-sm text-gray-600">Campagnes de sensibilisation</span>
          </div>
        </div>
      </div>

      {/* Map */}
      {mapOpen ? (
        <div className="relative bg-white rounded-xl overflow-hidden card-shadow border border-gray-100" style={{ height: '600px' }}>
          <button
            type="button"
            onClick={() => setMapOpen(false)}
            aria-label="Fermer la carte"
            title="Fermer la carte"
            className="absolute top-3 right-3 z-[1100] flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 shadow-md transition-colors hover:bg-gray-50 hover:text-gray-900"
          >
            <X size={18} />
          </button>
          {loading && interventions.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-naatal-green"></div>
            </div>
          ) : (
            <MapContainer center={[14.6937, -17.4441]} zoom={12} style={{ height: '100%', width: '100%' }}>
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {filteredInterventions.map((intervention) => (
                intervention.coord && (
                  <Marker
                    key={intervention.id}
                    position={intervention.coord}
                    icon={getIcon(intervention.pilier)}
                  >
                    <Popup>
                      <div className="p-1">
                        <h3 className="font-semibold text-gray-900 mb-2">{intervention.titre}</h3>
                        <div className="space-y-1 text-sm">
                          <p><span className="font-medium">Quartier:</span> {intervention.quartier}</p>
                          <p><span className="font-medium">Type:</span> {getTypeLabel(intervention.pilier)}</p>
                          <p><span className="font-medium">Date:</span> {intervention.date}</p>
                          <p><span className="font-medium">Statut:</span> {getStatusLabel(intervention.statut)}</p>
                          <p><span className="font-medium">Responsable:</span> {intervention.responsable}</p>
                          {intervention.objectifs && Object.keys(intervention.objectifs).length > 0 && (
                            <p><span className="font-medium">Objectifs:</span> {JSON.stringify(intervention.objectifs)}</p>
                          )}
                          {intervention.realisations && Object.keys(intervention.realisations).length > 0 && (
                            <p><span className="font-medium">Réalisations:</span> {JSON.stringify(intervention.realisations)}</p>
                          )}
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                )
              ))}
            </MapContainer>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl card-shadow border border-gray-100 p-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-gray-600">La carte des interventions est masquée.</p>
          <button
            type="button"
            onClick={() => setMapOpen(true)}
            className="flex items-center gap-2 rounded-lg bg-naatal-green px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-naatal-green-dark"
          >
            <MapPin size={16} />
            Afficher la carte
          </button>
        </div>
      )}
    </div>
  );
};

export default Carte;
