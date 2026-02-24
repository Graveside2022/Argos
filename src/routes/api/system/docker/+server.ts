import { json } from '@sveltejs/kit';

import { createHandler } from '$lib/server/api/create-handler';
import { errMsg } from '$lib/server/api/error-utils';
import { execFileAsync } from '$lib/server/exec';

/** Names that identify Argos-managed containers */
const ARGOS_CONTAINER_NAMES = ['argos', 'hackrf', 'openwebrx', 'bettercap'];

/** Parse docker ps output into structured container records */
function parseContainerOutput(psOutput: string) {
	return psOutput
		.trim()
		.split('\n')
		.filter((line) => line.length > 0)
		.map((line) => {
			const [name, state, status, image] = line.split('|');
			return { name, state, status, image };
		});
}

/** Filter containers belonging to the Argos stack */
function filterArgosContainers(containers: Array<{ name: string }>) {
	return containers.filter((c) =>
		ARGOS_CONTAINER_NAMES.some((keyword) => c.name.includes(keyword))
	);
}

/** Check whether an error message indicates Docker daemon is not running */
function isDockerNotRunning(msg: string): boolean {
	return msg.includes('Cannot connect') || msg.includes('Is the docker daemon running');
}

/** Build an error response for Docker endpoint failures */
function dockerErrorResponse(msg: string): Response {
	const errorText = isDockerNotRunning(msg) ? 'Docker daemon not running' : msg;
	return json({ success: false, error: errorText, docker_running: false });
}

/** Fetch Docker container list and system info, returning a success payload */
async function fetchDockerStatus() {
	const { stdout: psOutput } = await execFileAsync('/usr/bin/docker', [
		'ps',
		'-a',
		'--format',
		'{{.Names}}|{{.State}}|{{.Status}}|{{.Image}}'
	]);

	const containers = parseContainerOutput(psOutput);
	const argosContainers = filterArgosContainers(containers);

	const { stdout: infoOutput } = await execFileAsync('/usr/bin/docker', [
		'info',
		'--format',
		'{{json .}}'
	]);
	const dockerInfo = JSON.parse(infoOutput);

	return {
		success: true,
		docker_running: true,
		total_containers: containers.length,
		argos_containers: argosContainers.length,
		containers: argosContainers,
		system: {
			driver: dockerInfo.Driver || 'unknown',
			memory_limit: dockerInfo.MemoryLimit || false,
			swap_limit: dockerInfo.SwapLimit || false
		}
	};
}

export const GET = createHandler(async () => {
	try {
		return await fetchDockerStatus();
	} catch (error) {
		return dockerErrorResponse(errMsg(error));
	}
});
