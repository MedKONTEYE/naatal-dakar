import React from 'react';

// NAATAL ne stocke pas encore de photo de profil. En attendant, chaque compte
// dispose d'un avatar généré à partir de ses initiales et d'une couleur stable :
// l'identité visuelle reste reconnaissable sans dépendre d'un service externe.
const PALETTES = [
  'bg-emerald-100 text-emerald-800',
  'bg-sky-100 text-sky-800',
  'bg-amber-100 text-amber-800',
  'bg-rose-100 text-rose-800',
  'bg-violet-100 text-violet-800',
  'bg-teal-100 text-teal-800',
  'bg-orange-100 text-orange-800',
  'bg-indigo-100 text-indigo-800'
];

const SIZES = {
  xs: 'w-8 h-8 text-xs',
  sm: 'w-9 h-9 text-sm',
  md: 'w-11 h-11 text-base',
  lg: 'w-14 h-14 text-lg'
};

const DOT_SIZES = {
  xs: 'w-2.5 h-2.5',
  sm: 'w-2.5 h-2.5',
  md: 'w-3 h-3',
  lg: 'w-3.5 h-3.5'
};

const hashValue = (value) => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
};

const initialsFor = (nom, email) => {
  const source = String(nom || email || '?').trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
};

const Avatar = ({ nom, email, size = 'md', online, className = '', title }) => {
  const key = String(email || nom || '');
  const palette = PALETTES[hashValue(key) % PALETTES.length];
  const label = title || nom || email || 'Utilisateur';

  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center rounded-full font-semibold ${palette} ${SIZES[size] || SIZES.md} ${className}`}
      title={label}
      aria-label={label}
    >
      {initialsFor(nom, email)}
      {typeof online === 'boolean' && (
        <span
          className={`absolute bottom-0 right-0 rounded-full border-2 border-white ${DOT_SIZES[size] || DOT_SIZES.md} ${
            online ? 'bg-emerald-500' : 'bg-gray-300'
          }`}
          title={online ? 'En ligne' : 'Hors ligne'}
        />
      )}
    </span>
  );
};

export default Avatar;
