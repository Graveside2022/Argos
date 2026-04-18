import type { IncomingMessage, ServerResponse } from 'node:http';
import { createServer } from 'node:http';

import { handler } from '../../build/handler.js';
import {
	handleTerminalUpgrade,
	preSpawnDefaultSession
} from '../../src/lib/server/terminal/index.js';

const PORT = Number(process.env.PORT ?? 5173);
const HOST = process.env.HOST ?? '0.0.0.0';

const httpServer = createServer((req: IncomingMessage, res: ServerResponse) => {
	handler(req, res, () => {
		if (!res.headersSent) {
			res.statusCode = 404;
			res.end('Not Found');
		}
	});
});

httpServer.on('upgrade', (req, socket, head) => {
	if (handleTerminalUpgrade(req, socket, head)) return;
	socket.destroy();
});

httpServer.listen(PORT, HOST, () => {
	console.warn(`[argos-prod] listening on http://${HOST}:${PORT}`);
});

if (process.env.ARGOS_TERMINAL_PRESPAWN === '1') {
	void preSpawnDefaultSession();
}

const shutdown = () => {
	httpServer.close(() => process.exit(0));
	setTimeout(() => process.exit(1), 5000).unref();
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
