import { createHandler } from '$lib/server/api/create-handler';
import { resourceManager } from '$lib/server/hardware/resource-manager';

export const GET = createHandler(() => {
	return resourceManager.getStatus();
});
