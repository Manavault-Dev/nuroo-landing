export const healthRoutes = async (fastify) => {
    fastify.get('/health', async () => ({
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'nuroo-backend',
    }));
};
//# sourceMappingURL=health.routes.js.map