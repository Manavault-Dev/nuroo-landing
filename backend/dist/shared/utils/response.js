/**
 * Send a success response
 */
export function success(reply, data, statusCode = 200) {
    return reply.code(statusCode).send({ ok: true, ...data });
}
/**
 * Send an error response
 */
export function error(reply, message, statusCode = 400) {
    return reply.code(statusCode).send({ error: message });
}
/**
 * Send a not found response
 */
export function notFound(reply, resource = 'Resource') {
    return reply.code(404).send({ error: `${resource} not found` });
}
/**
 * Send a forbidden response
 */
export function forbidden(reply, message = 'Access denied') {
    return reply.code(403).send({ error: message });
}
/**
 * Send an unauthorized response
 */
export function unauthorized(reply, message = 'Unauthorized') {
    return reply.code(401).send({ error: message });
}
//# sourceMappingURL=response.js.map