import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'ghost';
  fullWidth?: boolean;
}

const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  fullWidth = false, 
  className = '', 
  ...props 
}) => {
  const baseStyles = "font-rounded font-bold py-3 px-6 rounded-2xl border-2 border-brand-brown transition-all duration-100 active:translate-y-1 active:shadow-none shadow-comic";
  
  const variants = {
    primary: "bg-brand-yellow hover:bg-[#FDEFCB] text-brand-brown",
    secondary: "bg-white hover:bg-gray-50 text-brand-brown",
    success: "bg-[#93C47D] hover:bg-[#A1D9AE] text-white border-brand-brown",
    danger: "bg-red-400 hover:bg-red-300 text-white",
    ghost: "bg-transparent border-none shadow-none active:translate-y-0 hover:bg-black/5"
  };

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

export default Button;