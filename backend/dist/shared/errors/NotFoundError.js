import { AppError } from './AppError.js';
export class NotFoundError extends AppError {
    constructor(resource, identifier) {
        const message = identifier
            ? `${resource} with id '${identifier}' not found`
            : `${resource} not found`;
        super(message, 404, 'NOT_FOUND');
        this.name = 'NotFoundError';
    }
}
//# sourceMappingURL=NotFoundError.js.map