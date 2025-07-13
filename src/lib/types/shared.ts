/**
 * Shared type definitions used across the application
 * This file contains common types that should be reused to ensure consistency
 */

import { SystemStatus, SignalSource as SignalSourceEnum } from './enums';

/**
 * Signal source types supported by the application
 * This is the canonical definition that should be used everywhere
 */
export type SignalSource = SignalSourceEnum;

/**
 * Device information interface used across the application
 * This ensures consistent device representation in all contexts
 */
export interface Device {
  id: string;
  type: string;
  name?: string;
  mac?: string;
  vendor?: string;
  firstSeen: number;
  lastSeen: number;
  signalCount: number;
  avgPower: number;
  freqMin: number;
  freqMax: number;
  lastLat: number;
  lastLon: number;
  metadata?: Record<string, unknown>;
}

/**
 * Device record as stored in the database
 * Uses the base Device interface (extend later if database-specific fields needed)
 */
export type DeviceRecord = Device;

/**
 * HackRF sweep manager state types
 * Defines all possible states for the sweep manager
 */
export type SweepManagerState = SystemStatus;

/**
 * WebSocket state types
 * Used for consistent state management across WebSocket connections
 */
export type WebSocketState = 'disconnected' | 'connecting' | 'connected' | 'error';

/**
 * Common error types used throughout the application
 */
export interface AppError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  timestamp: number;
}