import React, { useState, useEffect } from 'react';
import { 
  SignalIcon, 
  ExclamationTriangleIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';
import { apiService, DeviceInfo, FrequencyBand } from '../services/api';

const DeviceInfoPage: React.FC = () => {
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  const [frequencyBands, setFrequencyBands] = useState<FrequencyBand[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdateTime, setLastUpdateTime] = useState<string>('');

  useEffect(() => {
    const fetchDeviceInfo = async () => {
      try {
        const info = await apiService.getDeviceInfo();
        setDeviceInfo(info);
        setLastUpdateTime(new Date().toLocaleTimeString());
      } catch (error) {
        console.error('Error fetching device info:', error);
        setError('Failed to fetch device information');
      } finally {
        setLoading(false);
      }
    };

    fetchDeviceInfo();
    const interval = setInterval(() => {
      apiService.getDeviceInfo().then(setDeviceInfo).catch(console.error);
    }, 2000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const fetchFrequencyBands = async () => {
      try {
        const bands = await apiService.getFrequencyBands();
        setFrequencyBands(bands);
      } catch (error) {
        console.error('Error fetching frequency bands:', error);
        setError('Failed to load frequency bands');
      }
    };

    fetchFrequencyBands();
    const bandsInterval = setInterval(fetchFrequencyBands, 3000);

    return () => {
      clearInterval(bandsInterval);
    };
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

  const formatSampleRate = (rate: number): string => {
    if (rate >= 1e6) {
      return `${(rate / 1e6).toFixed(1)} MS/s`;
    } else if (rate >= 1e3) {
      return `${(rate / 1e3).toFixed(1)} kS/s`;
    }
    return `${rate} S/s`;
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
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Device Information</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">HackRF device status and configuration</p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="rounded-lg bg-danger-50 dark:bg-danger-900 border border-danger-200 dark:border-danger-700 p-4">
          <p className="text-sm text-danger-800 dark:text-danger-200">{error}</p>
        </div>
      )}

      {/* Device Status */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Device Status</h2>
          <div className={`status-indicator ${deviceInfo?.status === 'connected' ? 'status-connected' : 'status-disconnected'}`}>
            {deviceInfo?.status === 'connected' ? (
              <>
                <CheckCircleIcon className="h-4 w-4 mr-1" />
                Connected
              </>
            ) : (
              <>
                <ExclamationTriangleIcon className="h-4 w-4 mr-1" />
                Disconnected
              </>
            )}
          </div>
        </div>

        {deviceInfo?.error ? (
          <div className="rounded-lg bg-danger-50 dark:bg-danger-900 border border-danger-200 dark:border-danger-700 p-4">
            <p className="text-sm text-danger-800 dark:text-danger-200">{deviceInfo.error}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Current Frequency</p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                {deviceInfo?.current_frequency ? formatFrequency(deviceInfo.current_frequency) : 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Sample Rate</p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                {deviceInfo?.current_sample_rate ? formatSampleRate(deviceInfo.current_sample_rate) : 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Gain</p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                {deviceInfo?.current_gain ? `${deviceInfo.current_gain} dB` : 'N/A'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Device Details */}
      {deviceInfo?.info && (
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Device Details</h2>
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <pre className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-mono">
              {deviceInfo.info}
            </pre>
          </div>
        </div>
      )}

      {/* Frequency Bands */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Supported Frequency Bands</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {frequencyBands.map((band) => (
            <div key={band.name} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 bg-gray-50 dark:bg-gray-700">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium text-gray-900 dark:text-gray-100">{band.name}</h3>
                <SignalIcon className="h-5 w-5 text-gray-400 dark:text-gray-500" />
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{band.description}</p>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                <p>{formatFrequency(band.start_freq)} - {formatFrequency(band.end_freq)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* HackRF Specifications */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">HackRF Specifications</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-3">Frequency Range</h3>
            <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <li>• 1 MHz to 6 GHz</li>
              <li>• Tunable in 1 Hz steps</li>
              <li>• Full duplex operation</li>
            </ul>
          </div>
          <div>
            <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-3">Sample Rates</h3>
            <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <li>• Up to 20 MS/s</li>
              <li>• 8-bit I/Q samples</li>
              <li>• Configurable bandwidth</li>
            </ul>
          </div>
          <div>
            <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-3">Power Output</h3>
            <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <li>• -73 to +47 dB gain</li>
              <li>• Maximum 10 dBm output</li>
              <li>• Adjustable in 1 dB steps</li>
            </ul>
          </div>
          <div>
            <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-3">Connectivity</h3>
            <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <li>• USB 2.0 interface</li>
              <li>• SMA antenna connector</li>
              <li>• 50 ohm impedance</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Safety Information */}
      <div className="rounded-lg bg-yellow-50 dark:bg-yellow-900 border border-yellow-200 dark:border-yellow-700 p-4">
        <div className="flex items-start space-x-3">
          <ExclamationTriangleIcon className="h-6 w-6 text-yellow-600 dark:text-yellow-400 mt-0.5" />
          <div>
            <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">Important Safety Information</h3>
            <ul className="mt-2 text-sm text-yellow-700 dark:text-yellow-300 space-y-1">
              <li>• Never transmit on restricted frequencies (aviation, emergency, etc.)</li>
              <li>• Keep power levels within legal limits for your region</li>
              <li>• Ensure proper antenna connection before transmission</li>
              <li>• This device is for educational and authorized testing only</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeviceInfoPage; 