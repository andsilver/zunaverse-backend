import {
  Injectable,
  Logger,
  NestMiddleware,
  UnauthorizedException,
} from '@nestjs/common';
import { NextFunction, Response } from 'express';
import Moralis from 'moralis';
import { IWebhook } from '@moralisweb3/streams-typings';

@Injectable()
export class StreamAuthMiddleware implements NestMiddleware {
  logger = new Logger(StreamAuthMiddleware.name);

  use(req, res: Response, next: NextFunction) {
    const body: IWebhook = req.body;

    if (
      Moralis.Streams.verifySignature({
        body,
        signature: req.headers['x-signature'],
      })
    ) {
      if (body.confirmed) {
        this.logger.log(`Incoming stream: ${body.streamId} - ${body.tag}`);
        return next();
      } else {
        return res.status(200).json({
          success: true,
        });
      }
    }
    throw new UnauthorizedException('Invalid Stream');
  }
}
