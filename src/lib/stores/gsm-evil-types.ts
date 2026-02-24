/**
 * GSM Evil Store — Type Definitions and Constants
 * All interfaces, type aliases, default state, and storage constants.
 */

import type { Updater } from 'svelte/store';

export const STORAGE_KEY = 'gsm-evil-state';
export const STORAGE_VERSION = '1.0';
export const DEBOUNCE_MS = 2000;

export interface IMSICapture {
	imsi: string;
	tmsi?: string;
	mcc: string | number;
	mnc: string | number;
	lac: number;
	ci: number;
	lat?: number;
	lon?: number;
	timestamp: string;
	frequency?: string;
}

export interface TowerLocation {
	lat: number;
	lon: number;
	range?: number;
	samples?: number;
	city?: string;
	source?: string;
	lastUpdated?: string;
}

export interface ScanResult {
	frequency: string;
	power: number;
	strength: string;
	frameCount?: number;
	hasGsmActivity?: boolean;
	channelType?: string;
	controlChannel?: boolean;
	mcc?: string;
	mnc?: string;
	lac?: string;
	ci?: string;
}

export interface GSMEvilState {
	scanResults: ScanResult[];
	scanProgress: string[];
	scanStatus: string;
	selectedFrequency: string;
	isScanning: boolean;
	showScanProgress: boolean;
	scanAbortController: AbortController | null;
	canStopScan: boolean;
	scanButtonText: string;
	capturedIMSIs: IMSICapture[];
	totalIMSIs: number;
	towerLocations: Record<string, TowerLocation>;
	towerLookupAttempted: Record<string, boolean>;
	lastScanTime: string | null;
	storageVersion: string;
}

export const defaultState: GSMEvilState = {
	scanResults: [],
	scanProgress: [],
	scanStatus: '',
	selectedFrequency: '947.2',
	isScanning: false,
	showScanProgress: false,
	scanAbortController: null,
	canStopScan: false,
	scanButtonText: 'Start Scan',
	capturedIMSIs: [],
	totalIMSIs: 0,
	towerLocations: {},
	towerLookupAttempted: {},
	lastScanTime: null,
	storageVersion: STORAGE_VERSION
};

/** Fields excluded from localStorage — transient runtime state */
export const TRANSIENT_KEYS: (keyof GSMEvilState)[] = ['scanProgress', 'scanAbortController'];

export type StoreUpdate = (updater: Updater<GSMEvilState>) => void;
export type StoreSet = (value: GSMEvilState) => void;
