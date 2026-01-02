import React from 'react';
import { useUi } from '../contexts/UiContext';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: string[];
}

const Select: React.FC<SelectProps> = ({ label, options, className = '', ...props }) => {
  const { density } = useUi();
  const sizeStyles =
    density === 'compact'
      ? 'px-3 py-2 text-sm'
      : density === 'standard'
        ? 'px-4 py-3 text-base'
        : 'px-5 py-4 text-lg';

  return (
    <div className="w-full">
      {label && <label className="block text-brand-brown font-bold mb-2 ml-1">{label}</label>}
      <div className="relative">
        <select 
          className={`w-full rounded-2xl border-2 border-brand-brown focus:outline-none focus:ring-2 focus:ring-brand-yellow/50 bg-white font-medium text-brand-brown appearance-none ${sizeStyles} ${className}`}
          {...props}
        >
          {options.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
        <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-brand-brown">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7"></path></svg>
        </div>
      </div>
    </div>
  );
};

export default Select;
