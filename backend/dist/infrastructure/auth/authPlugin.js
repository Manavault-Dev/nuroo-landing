import { getAuth } from '../database/firebase.js';
import { config } from '../../config/index.js';
// Routes that don't require authentication
const PUBLIC_ROUTES = ['/health'];
// Routes that require special handling
const SKIP_AUTH_PATTERNS = [
    { path: '/dev/set-super-admin', onlyInDev: true },
    { path: '/bootstrap/', prefix: true },
];
function shouldSkipAuth(url, method) {
    // Allow health check and OPTIONS
    if (PUBLIC_ROUTES.includes(url) || method === 'OPTIONS') {
        return true;
    }
    // Check special patterns
    for (const pattern of SKIP_AUTH_PATTERNS) {
        if (pattern.onlyInDev && config.NODE_ENV === 'production') {
            continue;
        }
        if (pattern.prefix && url.startsWith(pattern.path)) {
            return true;
        }
        if (!pattern.prefix && url === pattern.path) {
            return true;
        }
    }
    return false;
}
export async function authPreHandler(request, reply) {
    if (shouldSkipAuth(request.url, request.method)) {
        return;
    }
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        return reply.code(401).send({ error: 'Missing or invalid Authorization header' });
    }
    try {
        const token = authHeader.substring(7);
        const auth = getAuth();
        const decodedToken = await auth.verifyIdToken(token);
        request.user = {
            uid: decodedToken.uid,
            email: decodedToken.email,
            claims: decodedToken,
        };
    }
    catch {
        return reply.code(401).send({ error: 'Invalid or expired token' });
    }
}
//# sourceMappingURL=authPlugin.js.map