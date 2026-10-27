import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export class AppError extends Error {
  public statusCode: number;
  public code: string;
  public details?: any;

  constructor(statusCode: number, code: string, message: string, details?: any) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found', details?: any) {
    super(404, 'NOT_FOUND', message, details);
  }
}

export class ConflictError extends AppError {
  constructor(message: string = 'Conflict: Resource already exists', details?: any) {
    super(409, 'DUPLICATE_TRANSACTION', message, details);
  }
}

export class InsufficientFundsError extends AppError {
  constructor(currentBalance: number, attemptedAmount: number) {
    super(
      422,
      'INSUFFICIENT_BALANCE',
      `Insufficient funds. Current balance is $${currentBalance.toFixed(2)}, attempted debit is $${attemptedAmount.toFixed(2)}.`,
      { current_balance: currentBalance, attempted_amount: attemptedAmount }
    );
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(400, 'VALIDATION_ERROR', message, details);
  }
}

export class ImmutableResourceError extends AppError {
  constructor(message: string = 'Transactions are immutable and cannot be updated or deleted') {
    super(405, 'TRANSACTION_IMMUTABLE', message);
  }
}

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Handle Zod Validation Errors
  if (err instanceof ZodError) {
    const formattedErrors = err.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        details: formattedErrors,
      },
    });
    return;
  }

  // Handle Custom Domain AppErrors
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
    });
    return;
  }

  // Handle Database Unique Constraint Violations (if caught from raw SQL)
  const errMessage = err?.message || '';
  if (errMessage.includes('UNIQUE constraint failed') || errMessage.includes('uq_account_reference') || err?.code === '23505') {
    res.status(409).json({
      success: false,
      error: {
        code: 'DUPLICATE_TRANSACTION',
        message: 'A transaction with this reference_id already exists for this account',
      },
    });
    return;
  }

  // Default to 500 Internal Server Error
  console.error('Unhandled Server Error:', err);
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected internal error occurred',
    },
  });
};
