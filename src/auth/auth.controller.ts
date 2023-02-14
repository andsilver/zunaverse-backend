import {
  BadRequestException,
  Body,
  Controller,
  InternalServerErrorException,
  Post,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { recoverTypedSignature_v4 } from 'eth-sig-util';
import Web3 from 'web3';
import jwt from 'jsonwebtoken';
import { generateNonce, SiweMessage } from 'siwe';

import { User } from '../database/entities/User';

@Controller('auth')
export class AuthController {
  @Post('verify')
  async verify(@Body() body: any) {
    const { message, signature, nonce } = body;

    const siweMessage = new SiweMessage(message);
    const fields = await siweMessage.validate(signature);

    if (nonce !== fields.nonce) {
      throw new UnprocessableEntityException('Invalid Nonce.');
    }
    const user = await User.findOrCreate(fields.address);

    if (nonce !== user.nonce) {
      throw new UnauthorizedException('Wrong Nonce.');
    }

    const accessToken = jwt.sign(
      {
        payload: {
          userId: user.id,
          ...fields,
        },
      },
      process.env.JWT_SECRET,
      {
        algorithm: 'HS256',
      },
    );
    return { accessToken, user };
  }

  @Post('nonce')
  async generateNonce(@Body() body: any) {
    const { pubKey } = body;

    if (!pubKey || !Web3.utils.isAddress(pubKey)) {
      throw new BadRequestException({
        message: 'Invalid Public Key',
      });
    }
    const nonce = generateNonce();

    try {
      const user = await User.findOrCreate(pubKey);
      user.nonce = nonce;
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
      // user.nonce = Math.floor(Math.random() * 10000);
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
