import { Controller, Get, Param, Res } from '@nestjs/common';
import { Response } from 'express';
import { Nft } from 'src/database/entities/Nft';
import { ShortLink } from 'src/database/entities/ShortLink';

@Controller('links')
export class ShareLinkController {
  @Get(':id')
  async shareNftLink(@Param('id') id: string, @Res() res: Response) {
    const shortLink = await ShortLink.findOneBy({ id });

    if (!shortLink) {
      return res.redirect('https://zunaverse.io');
    }
    const { tokenAddress, tokenId } = shortLink;

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

    return res.send(`
        <!doctype html>
        <html>
        <head>
            <title>${title}</title>
            <meta http-equiv="refresh" content="0;${url}">
            <meta name="title" content=${title} />
            <meta name="description" content=${description} />

            <meta property="og:type" content="website" />
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
