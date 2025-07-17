import React, { useEffect, useState } from 'react';
import axios from 'axios';

interface CachedSignal {
  filename: string;
  signal_type: string;
  protocol: string;
  parameters: Record<string, any>;
  sample_rate: number;
  duration: number;
  file_size_mb: number;
  created_time: number;
  checksum: string;
}

const formatDate = (timestamp: number) => {
  if (!timestamp) return '-';
  const date = new Date(timestamp * 1000);
  return date.toLocaleString();
};

const formatSize = (mb: number) => `${mb.toFixed(1)} MB`;

const Library: React.FC = () => {
  const [signals, setSignals] = useState<CachedSignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetchSignals = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await axios.get<CachedSignal[]>('/api/library');
        setSignals(res.data);
      } catch (e) {
        setError('Failed to load signal library');
      } finally {
        setLoading(false);
      }
    };
    fetchSignals();
  }, []);

  const filtered = signals.filter(sig =>
    sig.signal_type.toLowerCase().includes(search.toLowerCase()) ||
    sig.protocol.toLowerCase().includes(search.toLowerCase()) ||
    JSON.stringify(sig.parameters).toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-primary-50 to-blue-50 dark:from-primary-900 dark:to-blue-900 rounded-xl p-6 mb-6">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-2">Signal Library</h1>
        <p className="text-lg text-gray-600 dark:text-gray-400">Browse all pre-generated and cached RF signals available for instant transmission.</p>
      </div>
      <div className="mb-4 flex items-center justify-between">
        <input
          type="text"
          placeholder="Search by type, protocol, or parameters..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="input-field w-full max-w-md"
        />
      </div>
      {loading ? (
        <div className="flex flex-col items-center justify-center h-64 space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading signal library...</p>
        </div>
      ) : error ? (
        <div className="bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 rounded-lg p-4 text-center">{error}</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-8 text-center shadow-sm">
          <p className="text-gray-500 dark:text-gray-400">No signals found in the library.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead>
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Type</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Protocol</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Parameters</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Sample Rate</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Duration</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">File Size</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Created</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700">
              {filtered.map(sig => (
                <tr key={sig.filename}>
                  <td className="px-4 py-2 whitespace-nowrap font-medium text-gray-900 dark:text-gray-100">{sig.signal_type}</td>
                  <td className="px-4 py-2 whitespace-nowrap text-gray-700 dark:text-gray-300">{sig.protocol}</td>
                  <td className="px-4 py-2 whitespace-nowrap text-xs text-gray-500 dark:text-gray-400 max-w-xs truncate">
                    <pre className="whitespace-pre-wrap break-all text-xs">{JSON.stringify(sig.parameters, null, 1)}</pre>
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap text-gray-700 dark:text-gray-300">{sig.sample_rate ? (sig.sample_rate/1e6).toFixed(2) + ' MS/s' : '-'}</td>
                  <td className="px-4 py-2 whitespace-nowrap text-gray-700 dark:text-gray-300">{sig.duration ? sig.duration + ' s' : '-'}</td>
                  <td className="px-4 py-2 whitespace-nowrap text-gray-700 dark:text-gray-300">{formatSize(sig.file_size_mb)}</td>
                  <td className="px-4 py-2 whitespace-nowrap text-gray-700 dark:text-gray-300">{formatDate(sig.created_time)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Library; 