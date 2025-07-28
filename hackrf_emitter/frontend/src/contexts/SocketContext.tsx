import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  status: string;
  workflowStatus: string | null;
  currentWorkflow: string | null;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
  status: 'disconnected',
  workflowStatus: null,
  currentWorkflow: null,
  isDarkMode: false,
  toggleDarkMode: () => {},
});

export const useSocket = () => useContext(SocketContext);

interface SocketProviderProps {
  children: React.ReactNode;
}

export const SocketProvider: React.FC<SocketProviderProps> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [status, setStatus] = useState('disconnected');
  const [workflowStatus, setWorkflowStatus] = useState<string | null>(null);
  const [currentWorkflow, setCurrentWorkflow] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Initialize dark mode from localStorage
  useEffect(() => {
    const savedDarkMode = localStorage.getItem('darkMode') === 'true';
    setIsDarkMode(savedDarkMode);
    if (savedDarkMode) {
      document.documentElement.classList.add('dark');
    }
  }, []);

  const toggleDarkMode = () => {
    setIsDarkMode(prev => {
      const newDarkMode = !prev;
      localStorage.setItem('darkMode', newDarkMode.toString());
      if (newDarkMode) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      return newDarkMode;
    });
  };

  useEffect(() => {
    const newSocket = io(`http://${window.location.hostname}:5000`, {
      transports: ['polling', 'websocket'], // Start with polling for stability
      timeout: 20000, // Increase timeout to 20 seconds
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      randomizationFactor: 0.5,
    });

    newSocket.on('connect', () => {
      console.log('Connected to backend');
      setIsConnected(true);
      setStatus('connected');
    });

    newSocket.on('disconnect', (reason) => {
      console.log('Disconnected from backend:', reason);
      setIsConnected(false);
      setStatus('disconnected');
    });

    newSocket.on('connect_error', (error) => {
      // Suppress console errors when backend is not running
      if (process.env.NODE_ENV === 'development') {
        console.warn('WebSocket connection error (this is normal if backend is not running):', error.message);
      }
      setIsConnected(false);
      setStatus('disconnected');
    });

    newSocket.on('workflow_status', (data) => {
      console.log('Workflow status update:', data);
      setWorkflowStatus(data.status);
      
      // Handle workflow updates based on status
      if (data.status === 'running' || data.status === 'starting') {
        setCurrentWorkflow(data.workflow || null);
        setStatus('transmitting');
      } else if (data.status === 'stopped' || data.status === 'error') {
        console.log('Workflow stopped, clearing state');
        setStatus('connected');
        setCurrentWorkflow(null);
        setWorkflowStatus('stopped');
      }
    });

    newSocket.on('workflow_error', (data) => {
      console.error('Workflow error:', data);
      setStatus('error');
      setWorkflowStatus('error');
      setCurrentWorkflow(null);
    });

    setSocket(newSocket);

    return () => {
      if (newSocket) {
        newSocket.off(); // Remove all listeners
        newSocket.close();
      }
    };
  }, []);

  return (
    <SocketContext.Provider value={{ 
      socket, 
      isConnected, 
      status, 
      workflowStatus, 
      currentWorkflow,
      isDarkMode,
      toggleDarkMode
    }}>
      {children}
    </SocketContext.Provider>
  );
}; 