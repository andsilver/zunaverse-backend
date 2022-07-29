import {
  BadRequestException,
  Body,
  Controller,
  InternalServerErrorException,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import {
  recoverPersonalSignature,
  recoverTypedSignature_v4,
} from 'eth-sig-util';
import { bufferToHex } from 'ethereumjs-util';
import Web3 from 'web3';
import jwt from 'jsonwebtoken';

import { User } from '../database/entities/User';

@Controller('auth')
export class AuthController {
  @Post('nonce')
  async generateNonce(@Body() body: any) {
    const { pubKey } = body;

    if (!pubKey || !Web3.utils.isAddress(pubKey)) {
      throw new BadRequestException({
        message: 'Invalid Public Key',
      });
    }

    const nonce = Math.floor(Math.random() * 10000);

    try {
      let user = await User.findByPubKey(pubKey);

      if (!user) {
        user = User.create({
          pubKey: pubKey.toLowerCase(),
          nonce,
        });
      } else {
        user.nonce = nonce;
      }
      await user.save();

      return { nonce };
    } catch (err) {
      console.error('generateNonce error:\n', err);
      throw new InternalServerErrorException({
        message: 'Failed to generate nonce',
      });
    }
  }

  @Post('token')
  async generateToken(@Body() body: any) {
    const { signature, pubKey } = body;

    if (!signature || !pubKey) {
      throw new BadRequestException({
        message: 'Signature or pubKey is missing',
      });
    }

    try {
      const user = await User.findByPubKey(pubKey);

      if (!user) {
        throw new UnauthorizedException({
          message: 'User not found',
        });
      }
      // const msg = `${process.env.AUTH_SIGN_MESSAGE}: ${user.nonce}`;
      // const msgBufferHex = bufferToHex(Buffer.from(msg, 'utf8'));
      const address = recoverTypedSignature_v4({
        data: {
          domain: {
            name: 'Zunaverse',
            version: '1',
          },
          message: {
            nonce: user.nonce,
          },
          primaryType: 'Message',
          types: {
            Message: [
              {
                name: 'nonce',
                type: 'uint256',
              },
            ],
            EIP712Domain: [
              { name: 'name', type: 'string' },
              { name: 'version', type: 'string' },
            ],
          },
        } as any,
        sig: signature,
      });
      // recoverPersonalSignature({
      //   data: msgBufferHex,
      //   sig: signature,
      // });

      if (address.toLowerCase() !== pubKey.toLowerCase()) {
        throw new UnauthorizedException({
          message: 'Signature verification failed',
        });
      }
      user.nonce = Math.floor(Math.random() * 10000);
      await user.save();

      const accessToken = jwt.sign(
        {
          payload: {
            userId: user.id,
            pubKey,
          },
        },
        process.env.JWT_SECRET,
        {
          algorithm: 'HS256',
        },
      );

      return { accessToken, user };
    } catch (err) {
      console.error(err);
      throw new InternalServerErrorException('Failed to sign in');
    }
  }
}
