import React from 'react';

interface FormCheckboxProps {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
  description?: string;
}

export const FormCheckbox: React.FC<FormCheckboxProps> = ({
  id,
  label,
  checked,
  onChange,
  disabled = false,
  className = '',
  description
}) => {
  const checkboxClasses = "w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500";
  const labelClasses = "text-gray-700 font-medium";
  const spacingClasses = 'space-x-3';

  return (
    <div>
      <label className={`flex items-center ${spacingClasses} ${className}`}>
        <input
          type="checkbox"
          id={id}
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
          className={checkboxClasses}
        />
        <span className={labelClasses}>{label}</span>
      </label>
      {description && (
        <p className="text-sm text-gray-500 mt-1 ml-7">
          {description}
        </p>
      )}
    </div>
  );
};