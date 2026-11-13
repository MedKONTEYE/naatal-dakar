import React, { useState, useEffect } from 'react';
import { TreePine, Trash2, Users, UserCheck, TrendingUp } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import axios from 'axios';
import { useCampaign } from '../context/CampaignContext';
import { useDataSync } from '../context/DataSyncContext';
import { useProgramme } from '../context/ProgrammeContext';
import { formatDateFr } from '../utils/campagne';

const Dashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { revision } = useDataSync();
  const { campagne: campagnePartagee } = useCampaign();
  const { programme, objectifs: objectifsPartages } = useProgramme();

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        const response = await axios.get('/api/dashboard');
        if (cancelled) return;
        setData(response.data);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setError('Erreur lors du chargement des données du tableau de bord');
        console.error(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [revision]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-naatal-green"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        {error}
      </div>
    );
  }

  const kpis = [
    {
      title: 'Arbres plantés',
      icon: TreePine,
      realise: data?.realisations?.arbres || 0,
      objectif: data?.objectifs?.arbres ?? objectifsPartages?.arbres ?? 0,
      color: 'text-naatal-green',
      bgColor: 'bg-naatal-green-light'
    },
    {
      title: 'Déchets collectés',
      icon: Trash2,
      realise: data?.realisations?.dechets || 0,
      objectif: data?.objectifs?.dechets ?? objectifsPartages?.dechets ?? 0,
      unite: 'tonnes',
      color: 'text-blue-600',
      bgColor: 'bg-blue-50'
    },
    {
      title: 'Citoyens sensibilisés',
      icon: Users,
      realise: data?.realisations?.citoyensSensibilises || 0,
      objectif: data?.objectifs?.citoyensSensibilises ?? objectifsPartages?.citoyensSensibilises ?? 0,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50'
    },
    {
      title: 'Participants actifs',
      icon: UserCheck,
      realise: data?.realisations?.participantsActifs || 0,
      objectif: data?.objectifs?.participantsActifs ?? objectifsPartages?.participantsActifs ?? 0,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50'
    }
  ];

  const pieData = [
    { name: 'Reverdissement', value: data?.parPilier?.reverdissement || 0, color: '#21865B' },
    { name: 'Salubrité', value: data?.parPilier?.salubrite || 0, color: '#3B82F6' },
    { name: 'Mobilisation', value: data?.parPilier?.mobilisation || 0, color: '#8B5CF6' }
  ];

  // Ces deux indicateurs étaient figés dans l'interface : ils proviennent
  // désormais des interventions et des plantations réellement enregistrées.
  const interventionsPlanifiees = data?.parStatut?.planifiee ?? 0;
  const sitesAEntretenir = data?.sitesAEntretenir ?? 0;

  // Source unique : le contexte partagé, avec repli sur la réponse du tableau
  // de bord si l'appel dédié a échoué.
  const campagne = campagnePartagee || data?.campagne || null;
  const descriptionProgramme = programme?.description
    || `${programme?.nom || 'NAATAL DAKAR'} est l'initiative de ${programme?.initiative || 'la Ville de Dakar'} pour le reverdissement, la salubrité et la mobilisation citoyenne en faveur d'un Dakar plus vert et plus propre.`;

  // Le calendrier de campagne est piloté par l'administrateur : on n'affiche
  // jamais de date codée en dur dans l'interface.
  const etatCampagne = (() => {
    if (!campagne) return 'Période de campagne en cours de configuration';
    if (campagne.statut === 'planifiee') {
      const jours = campagne.joursAvantDebut;
      return `Début dans ${jours} jour${jours > 1 ? 's' : ''} — le ${formatDateFr(campagne.dateDebut)}`;
    }
    if (campagne.statut === 'terminee') {
      return `Campagne terminée le ${formatDateFr(campagne.dateFin)}`;
    }
    if (campagne.joursRestants === 0) {
      return `Dernier jour de la campagne • Jour ${campagne.jourActuel} sur ${campagne.dureeJours}`;
    }
    return `Jour ${campagne.jourActuel} sur ${campagne.dureeJours} • ${campagne.joursRestants} jour${campagne.joursRestants > 1 ? 's' : ''} restant${campagne.joursRestants > 1 ? 's' : ''}`;
  })();

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-naatal-green-dark to-naatal-green rounded-xl p-6 lg:p-8 text-white">
        <h1 className="text-2xl lg:text-3xl font-bold mb-2">Ensemble, faisons grandir l'avenir de Dakar.</h1>
        <p className="text-green-100 mb-4 max-w-2xl">
          {descriptionProgramme}
        </p>
        <span className="inline-block px-3 py-1 bg-white bg-opacity-20 rounded-full text-sm">
          {campagne?.libelle || 'Campagne — période à définir'}
        </span>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-green-100">
          {campagne && (
            <span className="px-2 py-0.5 rounded-full bg-white bg-opacity-20">{campagne.statutLabel}</span>
          )}
          <span>{etatCampagne}</span>
        </div>
        {campagne && (
          <div className="mt-3 max-w-md">
            <div className="w-full bg-white bg-opacity-25 rounded-full h-1.5">
              <div
                className="bg-white h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${campagne.progression}%` }}
              ></div>
            </div>
          </div>
        )}
        <div className="mt-4 text-xs text-green-200">
          Données synchronisées avec la base • Objectifs prévisionnels distincts des réalisations
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, index) => {
          const percentage = kpi.objectif > 0 ? Math.min(Math.round((kpi.realise / kpi.objectif) * 100), 100) : 0;
          return (
            <div key={index} className="bg-white rounded-xl p-5 card-shadow border border-gray-100">
              <div className="flex items-center justify-between mb-3">
                <div className={`p-2 rounded-lg ${kpi.bgColor}`}>
                  <kpi.icon className={kpi.color} size={22} />
                </div>
                <span className="text-xs px-2 py-1 bg-gray-100 rounded-full text-gray-600">
                  {percentage}%
                </span>
              </div>
              <h3 className="text-sm text-gray-600 mb-1">{kpi.title}</h3>
              <p className="text-2xl font-bold text-gray-900 mb-1">
                {kpi.realise.toLocaleString('fr-FR')} {kpi.unite || ''}
              </p>
              <p className="text-xs text-gray-500 mb-3">
                Objectif : {kpi.objectif.toLocaleString('fr-FR')} {kpi.unite || ''}
              </p>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-naatal-green h-2 rounded-full transition-all duration-500"
                  style={{ width: `${percentage}%` }}
                ></div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts and Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Evolution Chart */}
        <div className="lg:col-span-2 bg-white rounded-xl p-5 card-shadow border border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <TrendingUp size={20} className="text-naatal-green" />
            Évolution des réalisations ({campagne?.dureeJours || 30} jours)
          </h2>
          <p className="text-xs text-gray-500 mb-4">Projection calculée à partir des réalisations en base</p>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={data?.evolution?.slice(-10)}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="jour" stroke="#666" fontSize={12} />
              <YAxis stroke="#666" fontSize={12} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
              />
              <Line type="monotone" dataKey="arbres" stroke="#21865B" strokeWidth={2} name="Arbres" />
              <Line type="monotone" dataKey="dechets" stroke="#3B82F6" strokeWidth={2} name="Déchets (t)" />
              <Line type="monotone" dataKey="citoyens" stroke="#8B5CF6" strokeWidth={2} name="Citoyens" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Activities by Pillar */}
        <div className="bg-white rounded-xl p-5 card-shadow border border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Répartition par pilier</h2>
          <p className="text-xs text-gray-500 mb-4">Nombre d'interventions</p>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-4 space-y-2">
            {pieData.map((item, index) => (
              <div key={index} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                  <span className="text-gray-700">{item.name}</span>
                </div>
                <span className="font-medium text-gray-900">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Latest Interventions */}
        <div className="lg:col-span-2 bg-white rounded-xl p-5 card-shadow border border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Dernières interventions</h2>
          <div className="space-y-3">
            {data?.dernieresInterventions?.map((intervention) => (
              <div key={intervention.id} className="flex items-start justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex-1">
                  <h3 className="font-medium text-gray-900 text-sm">{intervention.titre}</h3>
                  <p className="text-xs text-gray-600 mt-1">{intervention.quartier} • {intervention.date}</p>
                  <span className={`inline-block mt-2 px-2 py-0.5 rounded-full text-xs ${
                    intervention.statut === 'terminee' ? 'bg-green-100 text-green-700' :
                    intervention.statut === 'en_cours' ? 'bg-blue-100 text-blue-700' :
                    intervention.statut === 'planifiee' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {intervention.statut === 'terminee' ? 'Terminée' :
                     intervention.statut === 'en_cours' ? 'En cours' :
                     intervention.statut === 'planifiee' ? 'Planifiée' : 'Annulée'}
                  </span>
                </div>
                <span className={`px-2 py-1 rounded text-xs ${
                  intervention.pilier === 'reverdissement' ? 'bg-naatal-green-light text-naatal-green-dark' :
                  intervention.pilier === 'salubrite' ? 'bg-blue-50 text-blue-700' :
                  'bg-purple-50 text-purple-700'
                }`}>
                  {intervention.pilier === 'reverdissement' ? 'Reverdissement' :
                   intervention.pilier === 'salubrite' ? 'Salubrité' : 'Mobilisation'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Actions & Teams */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl p-5 card-shadow border border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Actions prioritaires</h2>
            <div className="space-y-2">
              <div className="p-3 bg-yellow-50 border-l-4 border-yellow-400 rounded">
                <p className="text-sm font-medium text-yellow-800">
                  {interventionsPlanifiees} intervention{interventionsPlanifiees > 1 ? 's' : ''} planifiée{interventionsPlanifiees > 1 ? 's' : ''}
                </p>
                <p className="text-xs text-yellow-700 mt-1">
                  {interventionsPlanifiees > 0 ? 'À lancer selon le calendrier' : 'Aucune intervention en attente'}
                </p>
              </div>
              <div className="p-3 bg-blue-50 border-l-4 border-blue-400 rounded">
                <p className="text-sm font-medium text-blue-800">Suivi entretien plantations</p>
                <p className="text-xs text-blue-700 mt-1">
                  {sitesAEntretenir} site{sitesAEntretenir > 1 ? 's' : ''} nécessite{sitesAEntretenir > 1 ? 'nt' : ''} attention
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-5 card-shadow border border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Équipes mobilisées</h2>
            <div className="text-center">
              <p className="text-3xl font-bold text-naatal-green">{data?.equipesMobilisees || 0}</p>
              <p className="text-sm text-gray-600">sur {data?.totalEquipes || 0} équipes</p>
              <p className="text-xs text-gray-500 mt-2">Données enregistrées en base</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
