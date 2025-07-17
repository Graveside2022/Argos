import React, { useState, useEffect } from 'react';
import { Workflow } from '../services/api';

interface WorkflowFormProps {
  workflow: Workflow;
  onSubmit: (workflowName: string, parameters: Record<string, any>) => void;
  onCancel: () => void;
}

const WorkflowForm: React.FC<WorkflowFormProps> = ({ workflow, onSubmit, onCancel }) => {
  const [parameters, setParameters] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const initialParams: Record<string, any> = {};
    Object.entries(workflow.parameters).forEach(([key, param]) => {
      const p = param as any;
      if (p.type === 'select' && p.options && p.options.length > 0) {
        const firstOption = p.options[0];
        if (typeof firstOption === 'object' && firstOption.value !== undefined) {
          const defaultIndex = p.default || 0;
          initialParams[key] = p.options[defaultIndex]?.value || firstOption.value;
        } else {
          initialParams[key] = p.default || firstOption;
        }
      } else {
        initialParams[key] = p.default;
      }
    });
    setParameters(initialParams);
  }, [workflow]);

  const handleParameterChange = (key: string, value: any) => {
    setParameters(prev => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[key];
        return newErrors;
      });
    }
  };

  const validateParameters = (): boolean => {
    const newErrors: Record<string, string> = {};
    Object.entries(workflow.parameters).forEach(([key, param]) => {
      const value = parameters[key];
      const p = param as any;
      if (p.type === 'float' || p.type === 'int') {
        const numValue = parseFloat(value);
        if (isNaN(numValue)) {
          newErrors[key] = 'Must be a valid number';
        } else if (p.min !== undefined && numValue < p.min) {
          newErrors[key] = `Minimum value is ${p.min}`;
        } else if (p.max !== undefined && numValue > p.max) {
          newErrors[key] = `Maximum value is ${p.max}`;
        }
      } else if (p.type === 'string') {
        if (!value || value.trim() === '') {
          newErrors[key] = 'This field is required';
        }
      }
    });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateParameters()) return;
    setLoading(true);
    try {
      await onSubmit(workflow.name, parameters);
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  const getParameterFriendlyName = (key: string): string => {
    const nameMap: { [key: string]: string } = {
      'frequency': 'Frequency',
      'sample_rate': 'Sample Rate',
      'tx_gain': 'TX Gain',
      'gain': 'Gain',
      'duration': 'Duration',
      'bandwidth': 'Bandwidth',
      'modulation': 'Modulation',
      'data_rate': 'Data Rate',
      'power_level': 'Power Level',
      'packet_rate': 'Packet Rate',
      'satellite_id': 'Satellite ID',
      'signal_strength': 'Signal Strength',
      'icao_address': 'ICAO Address',
      'altitude': 'Altitude',
      'mmsi': 'MMSI',
      'vessel_name': 'Vessel Name'
    };
    return nameMap[key] || key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const renderParameterInput = (key: string, param: any) => {
    const value = parameters[key];
    const error = errors[key];
    if (param.type === 'float' || param.type === 'int') {
      return (
        <div key={key} className="space-y-1">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            {getParameterFriendlyName(key)}
            {param.unit && <span className="text-gray-500 dark:text-gray-400 ml-1">({param.unit})</span>}
          </label>
          <input
            type="number"
            value={value}
            onChange={(e) => handleParameterChange(key, param.type === 'int' ? parseInt(e.target.value) : parseFloat(e.target.value))}
            min={param.min}
            max={param.max}
            step={param.type === 'int' ? 1 : 'any'}
            className={`input-field ${error ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}`}
          />
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          {param.description && (
            <p className="text-xs text-gray-500 dark:text-gray-400">{param.description}</p>
          )}
        </div>
      );
    }
    if (param.type === 'select') {
      return (
        <div key={key} className="space-y-1">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            {getParameterFriendlyName(key)}
          </label>
          <select
            value={value}
            onChange={(e) => {
              const newValue = (key === 'target_channel' || key === 'bandwidth') ? parseInt(e.target.value) : e.target.value;
              handleParameterChange(key, newValue);
            }}
            className={`input-field ${error ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}`}
          >
            {param.options.map((option: any) => {
              if (typeof option === 'object' && option.value !== undefined && option.label !== undefined) {
                return (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                );
              } else {
                const optionValue = String(option);
                const displayText = typeof option === 'string' 
                  ? option.charAt(0).toUpperCase() + option.slice(1).replace(/_/g, ' ')
                  : optionValue;
                return (
                  <option key={optionValue} value={optionValue}>
                    {displayText}
                  </option>
                );
              }
            })}
          </select>
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          {param.description && (
            <p className="text-xs text-gray-500 dark:text-gray-400">{param.description}</p>
          )}
        </div>
      );
    }
    if (param.type === 'string') {
      return (
        <div key={key} className="space-y-1">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            {getParameterFriendlyName(key)}
          </label>
          <input
            type="text"
            value={value}
            onChange={(e) => handleParameterChange(key, e.target.value)}
            className={`input-field ${error ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}`}
          />
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          {param.description && (
            <p className="text-xs text-gray-500 dark:text-gray-400">{param.description}</p>
          )}
        </div>
      );
    }
    if (param.type === 'bool') {
      return (
        <div key={key} className="space-y-1">
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={value}
              onChange={(e) => handleParameterChange(key, e.target.checked)}
              className="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {getParameterFriendlyName(key)}
            </span>
          </label>
          {param.description && (
            <p className="text-xs text-gray-500 dark:text-gray-400">{param.description}</p>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="rounded-lg bg-yellow-50 dark:bg-yellow-900 border border-yellow-200 dark:border-yellow-700 p-4">
        <div>
          <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">Safety Information</h3>
          <p className="mt-1 text-sm text-yellow-700 dark:text-yellow-300">
            Please ensure your parameters comply with local RF regulations. 
            Verify transmission parameters before starting.
          </p>
        </div>
      </div>
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Parameters</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.entries(workflow.parameters).map(([key, param]) => 
            renderParameterInput(key, param as any)
          )}
        </div>
      </div>
      <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
        <button
          type="button"
          onClick={onCancel}
          className="btn-secondary"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading || Object.keys(errors).length > 0}
          className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
        >
          <span>{loading ? 'Starting...' : `Start ${workflow.display_name}`}</span>
        </button>
      </div>
    </form>
  );
};

export default WorkflowForm; 