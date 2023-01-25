import { Controller, Get, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { Nft } from 'src/database/entities/Nft';

@Controller('links')
export class ShareLinkController {
  @Get('nft')
  async shareNftLink(@Query() query: any, @Res() res: Response) {
    const tokenId = query.tokenId;
    const tokenAddress = query.tokenAddress?.toLowerCase();

    if (!tokenId || !tokenAddress) {
      return res.redirect('https://zunaverse.io');
    }
    const nft =
      (await Nft.findOneBy({ tokenId, tokenAddress })) ||
      (await Nft.getNftFromMoralis(tokenAddress, tokenId));

    if (!nft) {
      return res.redirect('https://zunaverse.io');
    }
    res.set('content-type', 'text/html');

    const title = nft.name;
    const description = nft.description;
    const url = `https://zunaverse.io/items/${tokenAddress}/${tokenId}`;
    const image = nft.thumbnail;

    console.log(title, description, url, image);

    return res.send(`
        <!doctype html>
        <html>
        <head>
            <title>${title}</title>
            <meta name="title" content=${title} />
            <meta name="description" content=${description} />

            <meta property="og:type" content="website" />
            <meta property="og:url" content=${url} />
            <meta property="og:title" content=${title} />
            <meta property="og:description" content=${description} />
            <meta property="og:image" content=${image} />

            <meta property="twitter:card" content="summary_large_image" />
            <meta property="twitter:url" content=${url} />
            <meta property="twitter:title" content=${title} />
            <meta property="twitter:description" content=${description} />
            <meta property="twitter:image" content=${image} />
        </head>
        </html>
    `);
  }
}
