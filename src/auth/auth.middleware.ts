import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User } from 'src/database/entities/User';

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  logger = new Logger(AuthMiddleware.name);

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
            this.logger.error('JWT Verification Error\n');
            this.logger.error(err);
            return next();
          }
          User.findOne({
            where: { id: decoded.payload.userId },
            relations: ['permission'],
          })
            .then((user) => {
              req.user = user;
            })
            .catch((error) => this.logger.error(error))
            .finally(() => next());
        },
      );
    } catch (err) {}
  }
}
