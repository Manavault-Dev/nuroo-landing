import { AppError } from './AppError.js';
export class ForbiddenError extends AppError {
    constructor(message = 'Access denied') {
        super(message, 403, 'FORBIDDEN');
        this.name = 'ForbiddenError';
    }
}
//# sourceMappingURL=ForbiddenError.js.map