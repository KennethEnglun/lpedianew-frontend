import React from 'react';
import { useUi } from '../contexts/UiContext';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

const Input: React.FC<InputProps> = ({ label, className = '', ...props }) => {
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
      <input 
        className={`w-full rounded-2xl border-2 border-brand-brown focus:outline-none focus:ring-2 focus:ring-brand-yellow/50 bg-white font-medium text-brand-brown ${sizeStyles} ${className}`}
        {...props}
      />
    </div>
  );
};

export default Input;
