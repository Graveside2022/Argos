/**
 * OFFNET RECON OSINT & Geospatial Intelligence tool categories:
 * - Geospatial Infrastructure Intelligence (Sightline)
 */

import type { ToolCategory } from '$lib/types/tools';

import { createTool } from './tool-factory';
import { toolIcons } from './tool-icons';

/** OSINT & Geospatial Intelligence subcategory */
export const osintGeoint: ToolCategory = {
	id: 'osint-geoint',
	name: 'OSINT & Geospatial Intelligence',
	description:
		'Discover real-world infrastructure using open-source intelligence and geospatial data',
	icon: toolIcons.geolocation,
	collapsible: true,
	defaultExpanded: false,
	children: [
		createTool(
			{
				id: 'sightline',
				name: 'Sightline',
				description:
					'Geospatial infrastructure intelligence — discovers telecom towers, data centers, military installations, and 200+ facility types via OpenStreetMap',
				icon: toolIcons.geolocation,
				deployment: 'docker'
			},
			{
				isInstalled: true,
				canOpen: true,
				shouldShowControls: false,
				externalUrl: 'http://localhost:3001'
			}
		)
	]
};
