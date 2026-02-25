import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  title?: string;
  icon?: React.ReactNode;
  footer?: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({ children, className = '', onClick, title, icon, footer }) => {
  return (
    <div 
      onClick={onClick}
      className={`bg-[#FFFFFF] rounded-[16px] border border-[#E5ECEA] shadow-[0_6px_18px_rgba(15,23,42,0.06)] p-6 transition-all ${
        onClick ? 'active:scale-95 cursor-pointer hover:shadow-[0_8px_20px_rgba(15,23,42,0.08)]' : ''
      } ${className}`}
    >
      {(title || icon) && (
        <div className="flex items-center gap-2 mb-3 text-slate-800">
          {icon && <span className="text-brand-600">{icon}</span>}
          {title && <h3 className="font-semibold text-lg leading-tight">{title}</h3>}
        </div>
      )}
      <div className="text-slate-600">
        {children}
      </div>
      {footer && (
        <div className="mt-4 pt-3 border-t border-slate-100">
          {footer}
        </div>
      )}
    </div>
  );
};