import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Menu, Bell, User, LogIn, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useProgramme } from '../context/ProgrammeContext';
import { useMessaging } from '../context/MessagingContext';
import { roleLabel } from '../utils/roles';

const Header = ({ onMenuClick }) => {
  const { user, isAuthenticated, logout } = useAuth();
  const { programme } = useProgramme();
  const { unreadTotal } = useMessaging();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <header className="bg-white border-b border-gray-200 px-4 lg:px-6 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 hover:bg-gray-100 rounded-lg"
            aria-label="Ouvrir le menu"
          >
            <Menu size={20} />
          </button>
          <div>
            <h1 className="text-lg font-semibold text-naatal-green-dark">{programme?.nom || 'NAATAL DAKAR'}</h1>
            <p className="text-xs text-gray-600 hidden sm:block truncate max-w-md">
              {programme?.coordination || 'Programme de gestion environnementale'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/messages"
            className="relative rounded-lg p-2 hover:bg-gray-100"
            aria-label={unreadTotal > 0 ? `Messages, ${unreadTotal} non lus` : 'Messages'}
            title="Messages"
          >
            <Bell size={20} className="text-gray-600" />
            {unreadTotal > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 inline-flex min-w-[18px] items-center justify-center rounded-full bg-naatal-green px-1 py-0.5 text-[10px] font-semibold text-white">
                {unreadTotal > 99 ? '99+' : unreadTotal}
              </span>
            ) : (
              <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-gray-300" />
            )}
          </Link>

          {isAuthenticated ? (
            <div className="flex items-center gap-1 pl-3 border-l border-gray-200">
              <Link
                to="/compte"
                className="flex items-center gap-3 px-2 py-1 rounded-lg hover:bg-gray-50 transition-colors"
                title="Mon compte"
              >
                <div className="w-8 h-8 bg-naatal-green-light rounded-full flex items-center justify-center">
                  <User size={18} className="text-naatal-green" />
                </div>
                <div className="hidden md:block">
                  <p className="text-sm font-medium text-gray-900">{user.nom}</p>
                  <p className="text-xs text-naatal-green-dark">{roleLabel(user.role)}</p>
                </div>
              </Link>
              <button
                onClick={handleLogout}
                className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="Se déconnecter"
              >
                <LogOut size={18} />
              </button>
            </div>
          ) : (
            <Link
              to="/login"
              className="flex items-center gap-2 px-3 py-2 bg-naatal-green text-white rounded-lg text-sm font-medium hover:bg-naatal-green-dark transition-colors"
            >
              <LogIn size={16} />
              <span className="hidden sm:inline">Se connecter</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
