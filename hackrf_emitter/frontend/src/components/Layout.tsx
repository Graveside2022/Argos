import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  HomeIcon, 
  CogIcon, 
  WifiIcon, 
  SignalIcon,
  ExclamationTriangleIcon,
  SunIcon,
  MoonIcon,
  BookOpenIcon,
  ArrowLeftIcon
} from '@heroicons/react/24/outline';
import { SocketProvider, useSocket } from '../contexts/SocketContext';

interface LayoutProps {
  children: React.ReactNode;
}

const LayoutContent: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const { isDarkMode, toggleDarkMode } = useSocket();

  const navigation = [
    { name: 'Dashboard', href: '/', icon: HomeIcon },
    { name: 'Workflows', href: '/workflows', icon: SignalIcon },
    { name: 'Library', href: '/library', icon: BookOpenIcon },
    { name: 'Device Info', href: '/device', icon: WifiIcon },
    { name: 'Settings', href: '/settings', icon: CogIcon },
  ];

  return (
    <div className="main-content">
      {/* Sidebar */}
      <div className="sidebar">
        {/* Title Section - Now at Top */}
        <div className="flex h-16 items-center justify-center border-b border-gray-200 dark:border-gray-700 px-4">
          <div className="flex items-center space-x-3">
            <SignalIcon className="h-8 w-8 text-primary-600 dark:text-primary-400" />
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">HackRF Emitter</h1>
          </div>
        </div>

        {/* Back to Console Button with Dark Mode - Now Below Title */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          {/* Left spacer */}
          <div className="w-10"></div>
          
          {/* Centered Back to Console Button */}
          <button
            onClick={() => window.open(`http://${window.location.hostname}:5173`, '_self')}
            className="btn-secondary flex items-center space-x-2 whitespace-nowrap"
            title="Back to Argos Console"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            <span>Back to Console</span>
          </button>
          
          {/* Dark Mode Button - Right side with more spacing */}
          <button
            onClick={toggleDarkMode}
            className="flex items-center justify-center w-10 h-10 rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-200"
            title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDarkMode ? (
              <SunIcon className="h-5 w-5" />
            ) : (
              <MoonIcon className="h-5 w-5" />
            )}
          </button>
        </div>
        
        <nav className="mt-8 px-4">
          <ul className="space-y-2">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <li key={item.name}>
                  <Link
                    to={item.href}
                    className={`nav-link ${
                      isActive ? 'nav-link-active' : 'nav-link-inactive'
                    }`}
                  >
                    <item.icon className="h-5 w-5" />
                    <span>{item.name}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>


        {/* Safety Notice */}
        <div className="absolute bottom-4 left-4 right-4">
          <div className="rounded-lg bg-yellow-50 dark:bg-yellow-900 border border-yellow-200 dark:border-yellow-700 p-3">
            <div className="flex items-start space-x-2">
              <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
              <div className="text-xs text-yellow-800 dark:text-yellow-200">
                <p className="font-medium">Safety Notice</p>
                <p>For educational use only. Comply with local RF regulations.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="pl-64">
        <main className="py-8 px-8">
          {children}
        </main>
      </div>
    </div>
  );
};

const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <SocketProvider>
      <LayoutContent>
        {children}
      </LayoutContent>
    </SocketProvider>
  );
};

export default Layout; 