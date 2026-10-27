import { z } from 'zod';

// UUID or valid string ID validator
export const uuidSchema = z
  .string()
  .trim()
  .min(1, 'ID must not be empty');

// Account creation validator
export const createAccountSchema = z.object({
  name: z
    .string({ required_error: 'Account name is required' })
    .trim()
    .min(1, 'Account name cannot be empty')
    .max(100, 'Account name must not exceed 100 characters'),
  // If a client attempts to pass initial balance, we reject it to strictly enforce requirement
  balance: z.undefined({
    invalid_type_error: 'Client is not allowed to set initial balance. Initial balance is always 0.',
  }),
});

// Transaction creation validator
export const createTransactionSchema = z.object({
  account_id: z
    .string()
    .trim()
    .min(1, 'Account ID is required')
    .optional(), // Can come from URL parameter or body
  type: z.enum(['credit', 'debit'], {
    errorMap: () => ({ message: "Transaction type must be either 'credit' or 'debit'" }),
  }),
  amount: z
    .number({ required_error: 'Amount is required', invalid_type_error: 'Amount must be a number' })
    .positive('Amount must be greater than 0')
    .refine(
      (val) => {
        // Enforce maximum 2 decimal places for financial calculations
        const parts = val.toString().split('.');
        return !parts[1] || parts[1].length <= 2;
      },
      { message: 'Amount cannot have more than 2 decimal places' }
    ),
  description: z.string().trim().max(255, 'Description must not exceed 255 characters').optional(),
  reference_id: z
    .string({ required_error: 'reference_id is required' })
    .trim()
    .min(1, 'reference_id cannot be empty')
    .max(100, 'reference_id must not exceed 100 characters'),
});

// Transfer validator (Bonus)
export const createTransferSchema = z
  .object({
    source_account_id: z
      .string({ required_error: 'source_account_id is required' })
      .trim()
      .min(1, 'source_account_id cannot be empty'),
    destination_account_id: z
      .string({ required_error: 'destination_account_id is required' })
      .trim()
      .min(1, 'destination_account_id cannot be empty'),
    amount: z
      .number({ required_error: 'Amount is required', invalid_type_error: 'Amount must be a number' })
      .positive('Amount must be greater than 0')
      .refine(
        (val) => {
          const parts = val.toString().split('.');
          return !parts[1] || parts[1].length <= 2;
        },
        { message: 'Amount cannot have more than 2 decimal places' }
      ),
    description: z.string().trim().max(255, 'Description must not exceed 255 characters').optional(),
    reference_id: z
      .string({ required_error: 'reference_id is required' })
      .trim()
      .min(1, 'reference_id cannot be empty')
      .max(100, 'reference_id must not exceed 100 characters'),
  })
  .refine(
    (data) => data.source_account_id !== data.destination_account_id,
    {
      message: 'Source and destination accounts must be different',
      path: ['destination_account_id'],
    }
  );

// Query params validator for transaction history
export const transactionHistoryQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 1))
    .refine((val) => !isNaN(val) && val >= 1, {
      message: 'page parameter must be a positive integer >= 1',
    }),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 10))
    .refine((val) => !isNaN(val) && val >= 1 && val <= 100, {
      message: 'limit parameter must be an integer between 1 and 100',
    }),
  type: z
    .enum(['credit', 'debit'])
    .optional(),
});
