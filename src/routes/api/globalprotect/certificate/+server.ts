import { z } from 'zod';

import { createHandler } from '$lib/server/api/create-handler';
import { GlobalProtectService } from '$lib/server/services/globalprotect/globalprotect-service';

const CertSchema = z.object({
	path: z.string().min(1).max(512)
});

export const POST = createHandler(
	async ({ request }) => {
		const body = await request.json();
		const { path } = CertSchema.parse(body);
		const service = GlobalProtectService.getInstance();
		const result = await service.importCertificate(path);
		return result;
	},
	{ validateBody: CertSchema }
);
