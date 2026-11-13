import React, { useState, useEffect } from 'react';
import { Users } from 'lucide-react';
import axios from 'axios';
import { useDataSync } from '../context/DataSyncContext';

const Mobilisation = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const { revision } = useDataSync();

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      try {
        const response = await axios.get('/api/citizens');
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

  if (loading && !data) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-naatal-green"></div></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Mobilisation citoyenne</h1>
        <p className="text-gray-600 mt-1">Sensibilisation, écoles, forums et caravanes • Données synchronisées avec la base</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-white rounded-xl p-4 card-shadow border border-gray-100">
          <Users className="text-purple-600 mb-2" size={22} />
          <p className="text-xl font-bold text-gray-900">{data?.stats?.citoyensSensibilises || 0}</p>
          <p className="text-xs text-gray-600">Citoyens sensibilisés</p>
        </div>
        <div className="bg-white rounded-xl p-4 card-shadow border border-gray-100">
          <p className="text-xl font-bold text-gray-900">{data?.stats?.participantsActifs || 0}</p>
          <p className="text-xs text-gray-600">Participants actifs</p>
        </div>
        <div className="bg-white rounded-xl p-4 card-shadow border border-gray-100">
          <p className="text-xl font-bold text-gray-900">{data?.stats?.publicsCibles || 0}</p>
          <p className="text-xs text-gray-600">Publics cibles</p>
        </div>
        <div className="bg-white rounded-xl p-4 card-shadow border border-gray-100">
          <p className="text-xl font-bold text-gray-900">{data?.stats?.campagnesOrganisees || 0}</p>
          <p className="text-xs text-gray-600">Campagnes</p>
        </div>
        <div className="bg-white rounded-xl p-4 card-shadow border border-gray-100">
          <p className="text-xl font-bold text-gray-900">{data?.stats?.activitesEcoles || 0}</p>
          <p className="text-xs text-gray-600">Activités écoles</p>
        </div>
        <div className="bg-white rounded-xl p-4 card-shadow border border-gray-100">
          <p className="text-xl font-bold text-gray-900">{data?.stats?.forumsCaravanes || 0}</p>
          <p className="text-xs text-gray-600">Forums/Caravanes</p>
        </div>
      </div>

      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <p className="text-sm text-green-800">{data?.note}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl card-shadow border border-gray-100 overflow-hidden">
          <div className="p-5 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Sensibilisations</h2>
          </div>
          <div className="divide-y divide-gray-200">
            {data?.sensibilisations?.map((s) => (
              <div key={s.id} className="p-4">
                <h3 className="font-medium text-gray-900">{s.titre}</h3>
                <p className="text-sm text-gray-600 mt-1">{s.quartier} • {s.date}</p>
                <p className="text-sm text-gray-700 mt-2">{s.realisations?.citoyens || 0} citoyens sensibilisés</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl card-shadow border border-gray-100 overflow-hidden">
          <div className="p-5 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Campagnes organisées</h2>
          </div>
          <div className="divide-y divide-gray-200">
            {data?.campagnes?.map((c) => (
              <div key={c.id} className="p-4">
                <h3 className="font-medium text-gray-900">{c.nom}</h3>
                <p className="text-sm text-gray-600 mt-1">{c.type} • {c.public}</p>
                <p className="text-sm text-gray-700 mt-2">{c.participants} participants • {c.dateDebut} - {c.dateFin}</p>
                <span className={`inline-block mt-2 px-2 py-1 rounded-full text-xs ${c.statut === 'terminee' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                  {c.statut === 'terminee' ? 'Terminée' : 'En cours'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Mobilisation;
