import React from 'react';

interface FormInputProps {
  id?: string;
  type?: 'text' | 'number' | 'url' | 'email';
  label?: string;
  value: string | number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  min?: string | number;
  max?: string | number;
  className?: string;
  description?: string;
}

export const FormInput: React.FC<FormInputProps> = ({
  id,
  type = 'text',
  label,
  value,
  onChange,
  placeholder,
  disabled = false,
  required = false,
  min,
  max,
  className = '',
  description
}) => {
  const baseInputClasses = "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors";
  const largeInputClasses = "w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors";
  
  const inputClasses = className.includes('large') ? largeInputClasses : baseInputClasses;

  return (
    <div>
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-2">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <input
        type={type}
        id={id}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        min={min}
        max={max}
        className={`${inputClasses} ${className}`}
      />
      {description && (
        <p className="text-sm text-gray-500 mt-1">{description}</p>
      )}
    </div>
  );
};