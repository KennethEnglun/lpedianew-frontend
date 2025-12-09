import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

const Input: React.FC<InputProps> = ({ label, className = '', ...props }) => {
  return (
    <div className="w-full">
      {label && <label className="block text-brand-brown font-bold mb-2 ml-1">{label}</label>}
      <input 
        className={`w-full px-4 py-3 rounded-2xl border-2 border-brand-brown focus:outline-none focus:ring-2 focus:ring-brand-yellow/50 bg-white font-medium text-brand-brown ${className}`}
        {...props}
      />
    </div>
  );
};

export default Input;