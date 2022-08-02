import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User } from 'src/database/entities/User';

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  async use(req: any, _res: Response, next: NextFunction) {
    const { authorization } = req.headers;

    if (!authorization) {
      return next();
    }

    try {
      const token = authorization.split(' ').pop();

      jwt.verify(
        token,
        process.env.JWT_SECRET,
        { algorithms: ['HS256'] },
        (err, decoded: jwt.JwtPayload) => {
          if (err) {
            Logger.error('JWT Verification Error\n');
            Logger.error(err);
            return next();
          }
          User.findByPubKey(decoded.payload.pubKey)
            .then((user) => {
              req.user = user;
              Logger.log(`Current User: ${user.pubKey}`);
            })
            .catch((error) => Logger.error(error))
            .finally(() => next());
        },
      );
    } catch (err) {}
  }
}
