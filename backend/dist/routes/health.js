export const healthRoute = async (fastify) => {
    fastify.get('/health', async () => ({
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'nuroo-backend',
    }));
};
//# sourceMappingURL=health.js.map