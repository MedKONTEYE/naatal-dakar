import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  MapPin, 
  ClipboardList, 
  TreePine, 
  Trash2, 
  Users, 
  UserCog, 
  FileText, 
  Settings,
  ShieldCheck,
  Plus,
  QrCode,
  Lock,
  User,
  MessageCircle
} from 'lucide-react';
import Logo from './Logo';
import { useAuth } from '../context/AuthContext';
import { useCampaign } from '../context/CampaignContext';
import { useProgramme } from '../context/ProgrammeContext';
import { useMessaging } from '../context/MessagingContext';
import { formatDateShortFr } from '../utils/campagne';

const Sidebar = ({ isOpen, onClose }) => {
  const { can, user, isAdmin } = useAuth();
  const { campagne } = useCampaign();
  const { programme } = useProgramme();
  const { unreadTotal } = useMessaging();
  const canWrite = can('operations.write');
  const organisation = programme?.sigle || 'DPDD';
  const navItems = [
    { path: '/', icon: LayoutDashboard, label: "Vue d'ensemble", adminOnly: true },
    { path: '/messages', icon: MessageCircle, label: "Messages", badge: unreadTotal },
    { path: '/carte', icon: MapPin, label: "Carte des interventions" },
    { path: '/interventions', icon: ClipboardList, label: "Interventions" },
    { path: '/reverdissement', icon: TreePine, label: "Reverdissement" },
    { path: '/scan-arbre', icon: QrCode, label: "Scanner un arbre" },
    { path: '/salubrite', icon: Trash2, label: "Salubrité" },
    { path: '/mobilisation', icon: Users, label: "Mobilisation citoyenne" },
    { path: '/equipes', icon: UserCog, label: "Équipes" },
    { path: '/rapports', icon: FileText, label: "Rapports" },
    { path: '/utilisateurs', icon: ShieldCheck, label: "Utilisateurs", permission: 'users.read' },
    { path: '/parametres', icon: Settings, label: "Paramètres" },
    ...(user ? [{ path: '/compte', icon: User, label: "Mon compte" }] : []),
  ].filter((item) => (!item.adminOnly || isAdmin) && (!item.permission || can(item.permission)));

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}
      
      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50
        w-72 bg-white border-r border-gray-200
        transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        flex flex-col
      `}>
        {/* Logo */}
        <div className="p-6 border-b border-gray-200">
          <Logo size="default" />
          <p className="text-xs text-gray-600 mt-2">Plateforme de gestion environnementale</p>
        </div>

        {/* Quick Action */}
        <div className="p-4">
          {canWrite ? (
            <NavLink
              to="/interventions"
              className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-naatal-green text-white rounded-lg hover:bg-naatal-green-dark transition-colors font-medium"
            >
              <Plus size={18} />
              <span>Nouvelle intervention</span>
            </NavLink>
          ) : (
            <span className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium">
              <Lock size={16} />
              Accès en lecture seule
            </span>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 pb-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              onClick={onClose}
              className={({ isActive }) => `
                flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors
                ${isActive 
                  ? 'bg-naatal-green-light text-naatal-green-dark font-medium' 
                  : 'text-gray-700 hover:bg-gray-50'
                }
              `}
            >
              <item.icon size={20} />
              <span className="flex-1 text-sm">{item.label}</span>
              {Number(item.badge) > 0 && (
                <span className="inline-flex min-w-[20px] items-center justify-center rounded-full bg-naatal-green px-1.5 py-0.5 text-[10px] font-semibold text-white">
                  {Number(item.badge) > 99 ? '99+' : item.badge}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200">
          <div className="text-xs text-gray-600">
            <p className="font-medium" title={programme?.coordination || undefined}>
              {programme?.initiative || 'Ville de Dakar'}
            </p>
            <p>{organisation}{campagne ? ` - Campagne ${campagne.dureeJours} jours` : ''}</p>
            <p
              className="mt-1 text-naatal-green"
              title={campagne ? `Du ${formatDateShortFr(campagne.dateDebut)} au ${formatDateShortFr(campagne.dateFin)}` : undefined}
            >
              {campagne?.periode || 'Période à définir'}
            </p>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
