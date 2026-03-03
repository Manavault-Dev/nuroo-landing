export function getCorsConfig(config) {
    return {
        origin: config.NODE_ENV === 'production'
            ? ['https://usenuroo.com']
            : [
                'http://localhost:3000',
                'http://localhost:3001',
                'http://127.0.0.1:3000',
                'http://127.0.0.1:3001',
            ],
        credentials: true,
    };
}
//# sourceMappingURL=cors.js.map