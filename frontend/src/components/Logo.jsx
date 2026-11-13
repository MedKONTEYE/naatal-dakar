import React from 'react';
import { Leaf } from 'lucide-react';

const Logo = ({ size = 'default' }) => {
  const sizes = {
    small: 'h-8',
    default: 'h-10',
    large: 'h-12'
  };
  
  return (
    <div className={`flex items-center gap-2 ${sizes[size]}`}>
      <div className="relative">
        <Leaf className="text-naatal-green" size={size === 'large' ? 32 : size === 'small' ? 24 : 28} />
      </div>
      <div className="flex flex-col">
        <span className="text-lg font-bold text-naatal-green-dark leading-tight">NAATAL</span>
        <span className="text-sm font-semibold text-naatal-green leading-tight -mt-1">DAKAR</span>
      </div>
    </div>
  );
};

export default Logo;
