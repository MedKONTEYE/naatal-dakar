import React, { useState, useEffect } from 'react';
import { Trash2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import axios from 'axios';
import { useDataSync } from '../context/DataSyncContext';

const Salubrite = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const { revision } = useDataSync();

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      try {
        const response = await axios.get('/api/waste');
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
        <h1 className="text-2xl font-bold text-gray-900">Salubrité et gestion des déchets</h1>
        <p className="text-gray-600 mt-1">Suivi des opérations de nettoyage • Données synchronisées avec la base</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-xl p-5 card-shadow border border-gray-100">
          <Trash2 className="text-blue-600 mb-2" size={24} />
          <p className="text-2xl font-bold text-gray-900">{data?.stats?.tonnesCollectees || 0}</p>
          <p className="text-sm text-gray-600">Tonnes collectées</p>
        </div>
        <div className="bg-white rounded-xl p-5 card-shadow border border-gray-100">
          <p className="text-2xl font-bold text-gray-900">{data?.stats?.operations || 0}</p>
          <p className="text-sm text-gray-600">Opérations</p>
        </div>
        <div className="bg-white rounded-xl p-5 card-shadow border border-gray-100">
          <p className="text-2xl font-bold text-yellow-600">{data?.stats?.enAttente || 0}</p>
          <p className="text-sm text-gray-600">En attente</p>
        </div>
        <div className="bg-white rounded-xl p-5 card-shadow border border-gray-100">
          <p className="text-2xl font-bold text-blue-600">{data?.stats?.enCours || 0}</p>
          <p className="text-sm text-gray-600">En cours</p>
        </div>
        <div className="bg-white rounded-xl p-5 card-shadow border border-gray-100">
          <p className="text-2xl font-bold text-green-600">{data?.stats?.terminees || 0}</p>
          <p className="text-sm text-gray-600">Terminées</p>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">{data?.note}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-5 card-shadow border border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Collecte par zone</h2>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data?.parZone || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="zone" stroke="#666" fontSize={11} angle={-45} textAnchor="end" height={80} />
              <YAxis stroke="#666" fontSize={12} />
              <Tooltip />
              <Bar dataKey="tonnes" fill="#3B82F6" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl card-shadow border border-gray-100 overflow-hidden">
          <div className="p-5 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Opérations de nettoyage</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Opération</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Zone</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Collecté</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {data?.nettoyages?.map((n) => (
                  <tr key={n.id}>
                    <td className="px-4 py-3 text-sm text-gray-900">{n.titre}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{n.quartier}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{n.realisations?.tonnes || 0} t</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs ${n.statut === 'terminee' ? 'bg-green-100 text-green-700' : n.statut === 'en_cours' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'}`}>
                        {n.statut === 'terminee' ? 'Terminée' : n.statut === 'en_cours' ? 'En cours' : 'Planifiée'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Salubrite;
