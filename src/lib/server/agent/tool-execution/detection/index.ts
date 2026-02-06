/**
 * Tool Detection System
 *
 * Auto-discovers installed tools and registers them with execution framework
 */

export { scanInstalledTools, detectTool, isToolInstalled } from './detector';
export {
	detectDockerContainers,
	findDockerContainer,
	checkDockerContainer
} from './docker-detector';
export { checkBinary, checkBinaries, getBinaryVersion } from './binary-detector';
export { checkService, checkServices, findServices } from './service-detector';
export { mapToExecutionTool, mapDetectedTools, type DetectedTool } from './tool-mapper';

export type { DockerContainer } from './docker-detector';
export type { BinaryInfo } from './binary-detector';
export type { ServiceInfo } from './service-detector';
