import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class AppMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const message = {
      HOST: req.hostname,
      PATH: req.originalUrl,
      METHOD: req.method,
      BODY: req.body,
      QUERY: req.query,
    };
    res.locals.input = {
      endpoint: req.originalUrl,
      startTs: Date.now(),
    };
    Logger.log(message, '- HTTP Request -');
    next();
  }
}
