import { z } from 'zod';

import { createHandler } from '$lib/server/api/create-handler';
import { GlobalProtectService } from '$lib/server/services/globalprotect/globalprotect-service';

const ConfigSchema = z.object({
	portal: z.string().max(253).optional(),
	username: z.string().max(256).optional(),
	connectOnStartup: z.boolean().optional()
});

export const GET = createHandler(async () => {
	const service = GlobalProtectService.getInstance();
	const config = service.getConfig() ?? service.loadConfig();
	return { success: true, config };
});

export const POST = createHandler(
	async ({ request }) => {
		const body = await request.json();
		const validated = ConfigSchema.parse(body);
		const service = GlobalProtectService.getInstance();
		const config = service.persistConfig(validated);
		return { success: true, config };
	},
	{ validateBody: ConfigSchema }
);
