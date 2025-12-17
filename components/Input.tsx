import React from 'react';
import { useUi } from '../contexts/UiContext';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  multiline?: boolean;
  rows?: number;
}

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  multiline: true;
  rows?: number;
}

type CombinedProps = InputProps | TextareaProps;

const Input: React.FC<CombinedProps> = ({ label, className = '', multiline, rows = 3, ...props }) => {
  const { density } = useUi();
  const sizeStyles =
    density === 'compact'
      ? 'px-3 py-2 text-sm'
      : density === 'standard'
        ? 'px-4 py-3 text-base'
        : 'px-5 py-4 text-lg';

  const baseStyles = `w-full rounded-2xl border-2 border-brand-brown focus:outline-none focus:ring-2 focus:ring-brand-yellow/50 bg-white font-medium text-brand-brown ${sizeStyles} ${className}`;

  return (
    <div className="w-full">
      {label && <label className="block text-brand-brown font-bold mb-2 ml-1">{label}</label>}
      {multiline ? (
        <textarea
          className={`${baseStyles} resize-y min-h-[2.5rem]`}
          rows={rows}
          {...(props as React.TextareaHTMLAttributes<HTMLTextAreaElement>)}
        />
      ) : (
        <input
          className={baseStyles}
          {...(props as React.InputHTMLAttributes<HTMLInputElement>)}
        />
      )}
    </div>
  );
};

export default Input;
