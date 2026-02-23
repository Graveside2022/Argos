/**
 * Shared type definitions used across the application
 * This file contains common types that should be reused to ensure consistency
 */

import { SystemStatus } from './enums';

/**
 * HackRF sweep manager state types
 * Defines all possible states for the sweep manager
 */
export type SweepManagerState = SystemStatus;
