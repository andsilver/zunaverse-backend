import {
  Injectable,
  Logger,
  NestMiddleware,
  UnauthorizedException,
} from '@nestjs/common';
import { NextFunction } from 'express';
import Moralis from 'moralis';
import { IWebhook } from '@moralisweb3/streams-typings';

@Injectable()
export class StreamAuthMiddleware implements NestMiddleware {
  logger = new Logger(StreamAuthMiddleware.name);

  use(req, _res: Response, next: NextFunction) {
    const body: IWebhook = req.body;

    if (
      Moralis.Streams.verifySignature({
        body,
        signature: req.headers['x-signature'],
      })
    ) {
      this.logger.log(`Incoming stream: ${body.tag}`);
      return next();
    }
    throw new UnauthorizedException('Invalid Stream');
  }
}
