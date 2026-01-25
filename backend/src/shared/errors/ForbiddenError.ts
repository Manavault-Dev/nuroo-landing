import { AppError } from './AppError.js'

export class ForbiddenError extends AppError {
  constructor(message: string = 'Access denied') {
    super(message, 403, 'FORBIDDEN')
    this.name = 'ForbiddenError'
  }
}
