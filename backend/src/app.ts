import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { config } from './config';
import apiRouter from './routes';
import { errorHandler, NotFoundError } from './middleware/errors';

export const createApp = (): Application => {
  const app = express();

  // Middleware
  app.use(cors({ origin: config.corsOrigin }));
  app.use(express.json());

  // Request logger in development
  if (config.nodeEnv !== 'test') {
    app.use((req: Request, res: Response, next: NextFunction) => {
      const start = Date.now();
      res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(`[${req.method}] ${req.originalUrl} -> ${res.statusCode} (${duration}ms)`);
      });
      next();
    });
  }

  // Root endpoint information
  app.get('/', (req: Request, res: Response) => {
    res.json({
      name: 'Transaction Ledger API',
      version: '1.0.0',
      docs: '/api/v1/health',
      endpoints: {
        accounts: '/api/v1/accounts',
        transactions: '/api/v1/transactions',
        transfers: '/api/v1/transfers',
        health: '/api/v1/health',
      },
    });
  });

  // Mount API router
  app.use('/api/v1', apiRouter);

  // 404 handler for undefined routes
  app.use((req: Request, res: Response, next: NextFunction) => {
    next(new NotFoundError(`Route ${req.method} ${req.originalUrl} not found`));
  });

  // Centralized Error Handling Middleware
  app.use(errorHandler);

  return app;
};
