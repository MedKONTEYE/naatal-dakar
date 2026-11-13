import React, { useState, useEffect } from 'react';
import { FileText, Download } from 'lucide-react';
import axios from 'axios';
import { useDataSync } from '../context/DataSyncContext';
import { formatDateFr } from '../utils/campagne';

const Rapports = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const { revision } = useDataSync();

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      try {
        const response = await axios.get('/api/reports');
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

  const exportCSV = () => {
    if (!data) return;
    const csvContent = "data:text/csv;charset=utf-8," 
      + "Indicateur,Valeur\n"
      + `Période,"${data?.campagne?.libelle || data?.periode || ''}"\n`
      + `Début de campagne,${data?.campagne?.dateDebut || ''}\n`
      + `Fin de campagne,${data?.campagne?.dateFin || ''}\n`
      + `Arbres plantés,${data.parPilier?.reverdissement?.realise || 0}\n`
      + `Déchets collectés,${data.parPilier?.salubrite?.realise || 0}\n`
      + `Citoyens sensibilisés,${data.parPilier?.mobilisation?.realise || 0}\n`
      + `Interventions totales,${data.totalInterventions || 0}\n`
      + `Activités terminées,${data.activitesTerminees || 0}\n`;
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "naatal_dakar_rapport.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading && !data) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-naatal-green"></div></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Rapports et statistiques</h1>
          <p className="text-gray-600 mt-1">Progression du programme • Données stockées en base</p>
        </div>
        <button onClick={exportCSV} className="flex items-center gap-2 px-4 py-2 bg-naatal-green text-white rounded-lg hover:bg-naatal-green-dark">
          <Download size={18} />
          <span>Exporter CSV</span>
        </button>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <p className="text-sm text-yellow-800">{data?.note}</p>
        <p className="text-sm text-yellow-800 mt-1">
          Période : {data?.campagne?.libelle || data?.periode}
        </p>
        {data?.campagne && (
          <p className="text-sm text-yellow-800 mt-1">
            Statut : {data.campagne.statutLabel} • Du {formatDateFr(data.campagne.dateDebut)} au {formatDateFr(data.campagne.dateFin)}
            {' '}({data.campagne.dureeJours} jour{data.campagne.dureeJours > 1 ? 's' : ''})
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-5 card-shadow border border-gray-100">
          <h3 className="font-semibold text-gray-900 mb-3">Reverdissement</h3>
          <p className="text-2xl font-bold text-naatal-green">{data?.parPilier?.reverdissement?.realise || 0} / {data?.parPilier?.reverdissement?.objectif ?? 0}</p>
          <p className="text-sm text-gray-600">arbres</p>
          <p className="text-xs text-gray-500 mt-2">{data?.parPilier?.reverdissement?.interventions || 0} interventions</p>
        </div>
        <div className="bg-white rounded-xl p-5 card-shadow border border-gray-100">
          <h3 className="font-semibold text-gray-900 mb-3">Salubrité</h3>
          <p className="text-2xl font-bold text-blue-600">{data?.parPilier?.salubrite?.realise || 0} / {data?.parPilier?.salubrite?.objectif ?? 0}</p>
          <p className="text-sm text-gray-600">tonnes</p>
          <p className="text-xs text-gray-500 mt-2">{data?.parPilier?.salubrite?.interventions || 0} interventions</p>
        </div>
        <div className="bg-white rounded-xl p-5 card-shadow border border-gray-100">
          <h3 className="font-semibold text-gray-900 mb-3">Mobilisation</h3>
          <p className="text-2xl font-bold text-purple-600">{data?.parPilier?.mobilisation?.realise || 0} / {data?.parPilier?.mobilisation?.objectif ?? 0}</p>
          <p className="text-sm text-gray-600">citoyens</p>
          <p className="text-xs text-gray-500 mt-2">{data?.parPilier?.mobilisation?.interventions || 0} interventions</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-5 card-shadow border border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Objectifs restants</h2>
          <div className="space-y-3">
            <div className="flex justify-between p-3 bg-gray-50 rounded">
              <span className="text-sm text-gray-700">Arbres à planter</span>
              <span className="font-medium text-gray-900">{data?.objectifsRestants?.arbres || 0}</span>
            </div>
            <div className="flex justify-between p-3 bg-gray-50 rounded">
              <span className="text-sm text-gray-700">Tonnes à collecter</span>
              <span className="font-medium text-gray-900">{data?.objectifsRestants?.dechets || 0}</span>
            </div>
            <div className="flex justify-between p-3 bg-gray-50 rounded">
              <span className="text-sm text-gray-700">Citoyens à sensibiliser</span>
              <span className="font-medium text-gray-900">{data?.objectifsRestants?.citoyens || 0}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 card-shadow border border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Résultats par quartier</h2>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {data?.parQuartier?.map((q, idx) => (
              <div key={idx} className="flex justify-between p-2 bg-gray-50 rounded text-sm">
                <span className="text-gray-700">{q.quartier}</span>
                <span className="text-gray-900">{q.interventions} interventions ({q.terminees} terminées)</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Rapports;
