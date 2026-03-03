const requestTimings = new WeakMap();
export async function requestLogger(request, reply) {
    const start = Date.now();
    requestTimings.set(request, start);
}
export async function requestLoggerOnSend(request, reply) {
    const startTime = requestTimings.get(request);
    if (startTime) {
        const duration = Date.now() - startTime;
        request.log.info({
            method: request.method,
            url: request.url,
            statusCode: reply.statusCode,
            duration: `${duration}ms`,
        });
        requestTimings.delete(request);
    }
}
//# sourceMappingURL=requestLogger.js.map