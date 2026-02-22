/**
 * Complete tool hierarchy for Argos
 * Organized as: TOOLS -> OFFNET/ONNET -> Workflow -> Categories -> Tools
 *
 * This aggregator imports domain-specific sub-modules and assembles the
 * full ToolHierarchy. Consumers should import from this file only.
 */

import type { ToolCategory, ToolDefinition, ToolHierarchy } from '$lib/types/tools';

import { droneDefeatGps, iotSubghzExploit, rfJamming, takExploit } from './offnet-attack-rf';
// OFFNET > ATTACK subcategories
import { btBleExploit, rogueAp, wifiDisruption } from './offnet-attack-wifi';
// OFFNET > RECON subcategories
import { cellularTrunked, spectrumAnalysis, wifiBtDiscovery } from './offnet-recon-signals';
import {
	aircraftMaritime,
	droneUasDetection,
	iotSubghzCollection,
	pagerAnalog,
	rfFingerprintingGeo,
	satelliteSigint
} from './offnet-recon-tracking';
// OFFNET > UTILITIES subcategories
import {
	passwordRecovery,
	sdrInfrastructure,
	signalRecording,
	takIntegration
} from './offnet-utilities';
// ONNET top-level category
import { onnetCategory } from './onnet';
import { toolIcons } from './tool-icons';

/** RECON workflow -- find and identify signals, devices, and emitters */
const reconWorkflow: ToolCategory = {
	id: 'recon',
	name: 'RECON',
	description: 'Find and identify signals, devices, and emitters in your area',
	icon: toolIcons.rfSpectrum,
	children: [
		spectrumAnalysis,
		wifiBtDiscovery,
		cellularTrunked,
		aircraftMaritime,
		satelliteSigint,
		pagerAnalog,
		iotSubghzCollection,
		droneUasDetection,
		rfFingerprintingGeo
	]
};

/** ATTACK workflow -- disrupt, deny, or exploit targets */
const attackWorkflow: ToolCategory = {
	id: 'attack',
	name: 'ATTACK',
	description: 'Disrupt, deny, or exploit targets using RF and wireless techniques',
	icon: toolIcons.counterAttack,
	children: [
		wifiDisruption,
		rogueAp,
		btBleExploit,
		droneDefeatGps,
		rfJamming,
		iotSubghzExploit,
		takExploit
	]
};

/** DEFENSE workflow -- detect threats targeting your own systems */
const defenseWorkflow: ToolCategory = {
	id: 'defense',
	name: 'DEFENSE',
	description: 'Detect threats targeting your own systems and communications',
	icon: toolIcons.network,
	children: [
		{
			id: 'cellular-threat-detection',
			name: 'Cellular Threat Detection',
			description: 'Detect fake cell towers and rogue base stations near your position',
			icon: toolIcons.cellular,
			collapsible: true,
			defaultExpanded: false,
			children: [
				{
					id: 'crocodile-hunter',
					name: 'Crocodile Hunter',
					description: 'EFF 4G/LTE fake base station detector using srsRAN',
					icon: toolIcons.cellular,
					isInstalled: false,
					deployment: 'docker',
					canOpen: false,
					shouldShowControls: false
				}
			]
		}
	]
};

/** UTILITIES workflow -- supporting tools for operations */
const utilitiesWorkflow: ToolCategory = {
	id: 'utilities',
	name: 'UTILITIES',
	description: 'Supporting tools for recording, analysis, and infrastructure',
	icon: toolIcons.folder,
	children: [signalRecording, sdrInfrastructure, passwordRecovery, takIntegration]
};

/** OFFNET top-level category */
const offnetCategory: ToolCategory = {
	id: 'offnet',
	name: 'OFFNET',
	description: 'Tools that work without connecting to a target network',
	icon: toolIcons.rfSpectrum,
	children: [reconWorkflow, attackWorkflow, defenseWorkflow, utilitiesWorkflow]
};

/** Complete tool hierarchy assembled from all sub-modules */
export const toolHierarchy: ToolHierarchy = {
	root: {
		id: 'tools-root',
		name: 'TOOLS',
		children: [offnetCategory, onnetCategory]
	}
};

/**
 * Navigate the tool hierarchy by a sequence of child IDs.
 * Returns the matching category or tool definition, or null if the path is invalid.
 */
export function findByPath(
	path: string[],
	root: ToolCategory
): ToolCategory | ToolDefinition | null {
	if (path.length === 0) return root;

	let current: ToolCategory | ToolDefinition = root;
	for (const id of path) {
		if ('children' in current) {
			const found: ToolCategory | ToolDefinition | undefined = current.children.find(
				(child) => child.id === id
			);
			if (!found) return null;
			current = found;
		} else {
			return null;
		}
	}
	return current;
}

/**
 * Count installed vs total tools in a category (recursive).
 * Leaf nodes (ToolDefinition) are counted; branch nodes (ToolCategory) are traversed.
 */
export function countTools(category: ToolCategory): { installed: number; total: number } {
	let installed = 0;
	let total = 0;

	for (const child of category.children) {
		if ('children' in child) {
			const childCount = countTools(child);
			installed += childCount.installed;
			total += childCount.total;
		} else {
			total++;
			if (child.isInstalled) installed++;
		}
	}

	return { installed, total };
}
