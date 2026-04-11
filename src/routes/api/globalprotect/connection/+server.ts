import { z } from 'zod';

import { createHandler } from '$lib/server/api/create-handler';
import { GlobalProtectService } from '$lib/server/services/globalprotect/globalprotect-service';

const ConnectSchema = z.object({
	portal: z.string().min(1).max(253),
	username: z.string().min(1).max(256),
	password: z.string().min(1).max(256)
});

export const GET = createHandler(async () => {
	const service = GlobalProtectService.getInstance();
	const status = await service.getStatus();
	return { success: true, ...status };
});

export const POST = createHandler(
	async ({ request }) => {
		const body = await request.json();
		const { portal, username, password } = ConnectSchema.parse(body);
		const service = GlobalProtectService.getInstance();
		const status = await service.connect(portal, username, password);
		return { success: status.status !== 'error', ...status };
	},
	{ validateBody: ConnectSchema }
);

export const DELETE = createHandler(async () => {
	const service = GlobalProtectService.getInstance();
	const status = await service.disconnect();
	return { success: true, ...status };
});
