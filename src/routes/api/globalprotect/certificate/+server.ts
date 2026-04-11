import { z } from 'zod';

import { createHandler } from '$lib/server/api/create-handler';
import { validatePathWithinDir } from '$lib/server/security/input-sanitizer';
import { GlobalProtectService } from '$lib/server/services/globalprotect/globalprotect-service';

const CERT_DIR = '/home/kali/.GlobalProtect';

const CertSchema = z.object({
	path: z.string().min(1).max(512)
});

export const POST = createHandler(
	async ({ request }) => {
		const body = await request.json();
		const { path } = body as z.infer<typeof CertSchema>;
		const safePath = validatePathWithinDir(path, CERT_DIR);
		const service = GlobalProtectService.getInstance();
		const result = await service.importCertificate(safePath);
		return result;
	},
	{ validateBody: CertSchema }
);
