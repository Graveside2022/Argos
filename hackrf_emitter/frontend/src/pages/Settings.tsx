import React, { useState, useEffect } from 'react';
import { 
  ExclamationTriangleIcon,
  ShieldCheckIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline';
import { apiService, SafetyLimits } from '../services/api';

const Settings: React.FC = () => {
  const [safetyLimits, setSafetyLimits] = useState<SafetyLimits | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const limits = await apiService.getSafetyLimits();
        setSafetyLimits(limits);
      } catch (error) {
        console.error('Error fetching safety limits:', error);
        setError('Failed to load safety limits');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const formatFrequency = (freq: number): string => {
    if (freq >= 1e9) {
      return `${(freq / 1e9).toFixed(2)} GHz`;
    } else if (freq >= 1e6) {
      return `${(freq / 1e6).toFixed(2)} MHz`;
    } else if (freq >= 1e3) {
      return `${(freq / 1e3).toFixed(2)} kHz`;
    }
    return `${freq} Hz`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Settings</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">System configuration and safety limits</p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="rounded-lg bg-danger-50 dark:bg-danger-900 border border-danger-200 dark:border-danger-700 p-4">
          <p className="text-sm text-danger-800 dark:text-danger-200">{error}</p>
        </div>
      )}

      {/* Safety Limits */}
      {safetyLimits && (
        <div className="card">
          <div className="flex items-center space-x-2 mb-4">
            <ShieldCheckIcon className="h-6 w-6 text-primary-600 dark:text-primary-400" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Safety Limits</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Maximum Power</p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                {safetyLimits.max_power_dbm} dBm
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Gain Range</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {safetyLimits.min_gain} to {safetyLimits.max_gain} dB
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Duration Limits</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {safetyLimits.min_duration}s - {safetyLimits.max_duration}s
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Frequency Range</p>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {formatFrequency(safetyLimits.frequency_range.min)} - {formatFrequency(safetyLimits.frequency_range.max)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Restricted Frequencies */}
      {safetyLimits && (
        <div className="card">
          <div className="flex items-center space-x-2 mb-4">
            <ExclamationTriangleIcon className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Restricted Frequency Bands</h2>
          </div>
          
          <div className="space-y-3">
            {safetyLimits.restricted_frequencies.map((band, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-yellow-50 dark:bg-yellow-900 rounded-lg border border-yellow-200 dark:border-yellow-700">
                <div>
                  <p className="font-medium text-gray-900 dark:text-gray-100">{band.description}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {formatFrequency(band.start)} - {formatFrequency(band.end)}
                  </p>
                </div>
                <div className="text-yellow-600 dark:text-yellow-400">
                  <ExclamationTriangleIcon className="h-5 w-5" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* System Information */}
      <div className="card">
        <div className="flex items-center space-x-2 mb-4">
          <InformationCircleIcon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">System Information</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-3">Backend API</h3>
            <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <li>• Flask REST API</li>
              <li>• WebSocket support</li>
              <li>• CORS enabled</li>
              <li>• Real-time status updates</li>
            </ul>
          </div>
          <div>
            <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-3">Frontend</h3>
            <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <li>• React TypeScript</li>
              <li>• Tailwind CSS</li>
              <li>• Responsive design</li>
              <li>• Real-time WebSocket</li>
              <li>• Dark mode support</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Safety Guidelines */}
      <div className="card">
        <div className="flex items-center space-x-2 mb-4">
          <ShieldCheckIcon className="h-6 w-6 text-green-600 dark:text-green-400" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Safety Guidelines</h2>
        </div>
        
        <div className="space-y-4">
          <div className="bg-green-50 dark:bg-green-900 border border-green-200 dark:border-green-700 rounded-lg p-4">
            <h3 className="font-medium text-green-800 dark:text-green-200 mb-2">Before Transmission</h3>
            <ul className="text-sm text-green-700 dark:text-green-300 space-y-1">
              <li>• Verify frequency is not in restricted bands</li>
              <li>• Check power levels are within limits</li>
              <li>• Ensure proper antenna connection</li>
              <li>• Confirm you have authorization to transmit</li>
            </ul>
          </div>
          
          <div className="bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
            <h3 className="font-medium text-blue-800 dark:text-blue-200 mb-2">During Transmission</h3>
            <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
              <li>• Monitor for interference with other systems</li>
              <li>• Keep transmission duration reasonable</li>
              <li>• Be prepared to stop immediately if needed</li>
              <li>• Document your testing activities</li>
            </ul>
          </div>
          
          <div className="bg-yellow-50 dark:bg-yellow-900 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4">
            <h3 className="font-medium text-yellow-800 dark:text-yellow-200 mb-2">Legal Compliance</h3>
            <ul className="text-sm text-yellow-700 dark:text-yellow-300 space-y-1">
              <li>• Always comply with local RF regulations</li>
              <li>• Never transmit on emergency frequencies</li>
              <li>• Respect aviation and marine bands</li>
              <li>• This system is for educational use only</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Emergency Stop Information */}
      <div className="rounded-lg bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 p-4">
        <div className="flex items-start space-x-3">
          <ExclamationTriangleIcon className="h-6 w-6 text-red-600 dark:text-red-400 mt-0.5" />
          <div>
            <h3 className="text-sm font-medium text-red-800 dark:text-red-200">Emergency Stop</h3>
            <p className="mt-1 text-sm text-red-700 dark:text-red-300">
              If you need to stop transmission immediately, use the "Stop Transmission" button 
              on the dashboard or workflows page. The system will halt all RF output within seconds.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings; 