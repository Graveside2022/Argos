import React, { useState, useEffect } from 'react';
import { 
  SignalIcon, 
  WifiIcon, 
  ExclamationTriangleIcon,
  StopIcon,
  ClockIcon,
  CheckCircleIcon,
  PlayIcon,
  CpuChipIcon
} from '@heroicons/react/24/outline';
import { useSocket } from '../contexts/SocketContext';
import { apiService, SystemStatus, DeviceInfo } from '../services/api';

const Dashboard: React.FC = () => {
  const { isConnected, workflowStatus, currentWorkflow } = useSocket();
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [lastUpdateTime, setLastUpdateTime] = useState<string>('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statusData, deviceData] = await Promise.all([
          apiService.getStatus(),
          apiService.getDeviceInfo()
        ]);
        setSystemStatus(statusData);
        setDeviceInfo(deviceData);
        setLastUpdateTime(new Date().toLocaleTimeString());
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
        setError('Failed to fetch system status');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 2000); // Refresh every 2 seconds

    return () => {
      clearInterval(interval);
    };
  }, []);

  // Clear success/error messages after 5 seconds
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // Merge real-time socket data with API data
  // Prioritize WebSocket data over API data for real-time accuracy
  const isTransmitting = workflowStatus === 'running' || 
    (workflowStatus !== 'stopped' && systemStatus?.is_transmitting) || false;
  const activeWorkflow = workflowStatus === 'stopped' ? 'None' : 
    (currentWorkflow || systemStatus?.current_workflow || 'None');

  const handleStopWorkflow = async () => {
    setActionLoading(true);
    setError(null);
    
    try {
      await apiService.stopWorkflow();
      setSuccess('Workflow stopped successfully!');
    } catch (error) {
      console.error('Error stopping workflow:', error);
      setError(`Failed to stop workflow: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleQuickStart = async (workflowName: string) => {
    setActionLoading(true);
    setError(null);
    
    try {
      // Use default parameters for quick start
      const defaultParams = {
        frequency: 100e6,
        duration: 30,
        amplitude: 0.5
      };
      
      await apiService.startWorkflow(workflowName, defaultParams);
      setSuccess(`Started ${workflowName} with default settings!`);
    } catch (error) {
      console.error('Error starting workflow:', error);
      setError(`Failed to start ${workflowName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusIndicator = () => {
    if (!isConnected) {
      return {
        text: 'Disconnected',
        color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
        icon: ExclamationTriangleIcon,
        iconColor: 'text-red-600 dark:text-red-400'
      };
    }
    
    if (isTransmitting) {
      return {
        text: 'Transmitting',
        color: 'bg-primary-100 text-primary-800 dark:bg-primary-900 dark:text-primary-200',
        icon: SignalIcon,
        iconColor: 'text-primary-600 dark:text-primary-400 animate-pulse'
      };
    }
    
    return {
      text: 'Ready',
      color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      icon: CheckCircleIcon,
      iconColor: 'text-green-600 dark:text-green-400'
    };
  };

  const statusIndicator = getStatusIndicator();

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Dashboard</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Monitor and control your HackRF emitter
            {lastUpdateTime && (
              <span className="text-sm ml-2">• Last updated: {lastUpdateTime}</span>
            )}
          </p>
        </div>
        
        {/* System Status Badge */}
        <div className={`inline-flex items-center px-3 py-2 rounded-full text-sm font-medium ${statusIndicator.color}`}>
          <statusIndicator.icon className={`h-4 w-4 mr-2 ${statusIndicator.iconColor}`} />
          {statusIndicator.text}
        </div>
      </div>

      {/* Status Messages */}
      {success && (
        <div className="rounded-lg bg-green-50 dark:bg-green-900 border border-green-200 dark:border-green-700 p-4">
          <div className="flex items-center">
            <CheckCircleIcon className="h-5 w-5 text-green-600 dark:text-green-400 mr-2" />
            <p className="text-sm text-green-800 dark:text-green-200">{success}</p>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 p-4">
          <div className="flex items-center">
            <ExclamationTriangleIcon className="h-5 w-5 text-red-600 dark:text-red-400 mr-2" />
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
        </div>
      )}

      {/* Active Transmission Banner */}
      {isTransmitting && activeWorkflow && activeWorkflow !== 'None' && (
        <div className="rounded-lg bg-primary-50 dark:bg-primary-900 border border-primary-200 dark:border-primary-700 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex-shrink-0">
                <div className="w-4 h-4 bg-primary-600 rounded-full animate-pulse"></div>
              </div>
              <div>
                <h3 className="text-lg font-medium text-primary-800 dark:text-primary-200">
                  🚀 Transmission Active
                </h3>
                <p className="text-primary-600 dark:text-primary-300">
                  <SignalIcon className="inline h-4 w-4 mr-1" />
                  Current workflow: <span className="font-semibold">{activeWorkflow}</span>
                </p>
              </div>
            </div>
            <button
              onClick={handleStopWorkflow}
              disabled={actionLoading}
              className="btn-danger flex items-center space-x-2 disabled:opacity-50"
            >
              <StopIcon className="h-4 w-4" />
              <span>{actionLoading ? 'Stopping...' : 'Emergency Stop'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Backend Connection */}
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Backend Status</p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                {isConnected ? 'Connected' : 'Disconnected'}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                WebSocket: {isConnected ? '✅ Active' : '❌ Inactive'}
              </p>
            </div>
            <div className={`p-2 rounded-full ${isConnected ? 'bg-green-100 dark:bg-green-900' : 'bg-red-100 dark:bg-red-900'}`}>
              <WifiIcon className={`h-6 w-6 ${isConnected ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`} />
            </div>
          </div>
        </div>

        {/* HackRF Connection */}
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">HackRF Device</p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                {systemStatus?.hackrf_connected ? 'Connected' : 'Disconnected'}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Gain: {deviceInfo?.current_gain || 'N/A'} dB
              </p>
            </div>
            <div className={`p-2 rounded-full ${systemStatus?.hackrf_connected ? 'bg-green-100 dark:bg-green-900' : 'bg-red-100 dark:bg-red-900'}`}>
              <CpuChipIcon className={`h-6 w-6 ${systemStatus?.hackrf_connected ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`} />
            </div>
          </div>
        </div>

        {/* Transmission Status */}
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Transmission</p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                {isTransmitting ? 'Active' : 'Idle'}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {deviceInfo?.current_frequency 
                  ? `${(deviceInfo.current_frequency / 1e6).toFixed(2)} MHz`
                  : 'No frequency set'
                }
              </p>
            </div>
            <div className={`p-2 rounded-full ${isTransmitting ? 'bg-primary-100 dark:bg-primary-900' : 'bg-gray-100 dark:bg-gray-700'}`}>
              <SignalIcon className={`h-6 w-6 ${isTransmitting ? 'text-primary-600 dark:text-primary-400 animate-pulse' : 'text-gray-600 dark:text-gray-400'}`} />
            </div>
          </div>
        </div>

        {/* Current Workflow */}
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Current Workflow</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-gray-100 break-words">
                {activeWorkflow}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Status: {workflowStatus || 'idle'}
              </p>
            </div>
            <div className="p-2 rounded-full bg-gray-100 dark:bg-gray-700">
              <ClockIcon className="h-6 w-6 text-gray-600 dark:text-gray-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Quick Actions</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Emergency Stop */}
          <button
            onClick={handleStopWorkflow}
            disabled={!isTransmitting || actionLoading}
            className="btn-danger disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 h-12"
          >
            <StopIcon className="h-5 w-5" />
            <span>{actionLoading ? 'Stopping...' : 'Stop Transmission'}</span>
          </button>

          {/* Quick Start Sine Wave */}
          <button
            onClick={() => handleQuickStart('sine_wave')}
            disabled={!isConnected || isTransmitting || actionLoading}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 h-12"
          >
            <PlayIcon className="h-5 w-5" />
            <span>Quick Sine Wave</span>
          </button>

          {/* Quick Start FM */}
          <button
            onClick={() => handleQuickStart('fm_modulation')}
            disabled={!isConnected || isTransmitting || actionLoading}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 h-12"
          >
            <PlayIcon className="h-5 w-5" />
            <span>Quick FM</span>
          </button>

          {/* Status Refresh */}
          <button
            onClick={() => window.location.reload()}
            disabled={actionLoading}
            className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 h-12"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>Refresh Status</span>
          </button>
        </div>

        {/* Help Text */}
        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900 rounded-lg">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            💡 <strong>Quick Actions:</strong> Use these buttons for immediate control. 
            For detailed configuration, visit the Workflows page.
          </p>
        </div>
      </div>

      {/* Device Information */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Device Information</h2>
          {deviceInfo ? (
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Status:</span>
                <span className={`font-medium ${deviceInfo.status === 'connected' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {deviceInfo.status}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Frequency:</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  {deviceInfo.current_frequency 
                    ? `${(deviceInfo.current_frequency / 1e6).toFixed(2)} MHz`
                    : 'Not set'
                  }
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Sample Rate:</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  {deviceInfo.current_sample_rate 
                    ? `${(deviceInfo.current_sample_rate / 1e6).toFixed(1)} MS/s`
                    : 'Not set'
                  }
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Gain:</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  {deviceInfo.current_gain !== undefined ? `${deviceInfo.current_gain} dB` : 'Not set'}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-gray-500 dark:text-gray-400">No device information available</p>
          )}
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">System Information</h2>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Backend:</span>
              <span className={`font-medium ${isConnected ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {isConnected ? 'Online' : 'Offline'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">HackRF:</span>
              <span className={`font-medium ${systemStatus?.hackrf_connected ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {systemStatus?.hackrf_connected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Last Update:</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {lastUpdateTime || 'Never'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Workflows:</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">
                192 Available
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Safety Notice */}
      <div className="rounded-lg bg-yellow-50 dark:bg-yellow-900 border border-yellow-200 dark:border-yellow-700 p-4">
        <div className="flex items-start space-x-3">
          <ExclamationTriangleIcon className="h-6 w-6 text-yellow-600 dark:text-yellow-400 mt-0.5" />
          <div>
            <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">Safety Reminder</h3>
            <p className="mt-1 text-sm text-yellow-700 dark:text-yellow-300">
              This system is for educational and authorized testing purposes only. 
              Always ensure compliance with local regulations regarding RF transmission. 
              Never transmit on restricted frequencies or exceed legal power limits.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard; 