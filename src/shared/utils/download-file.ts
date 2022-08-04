import * as stream from 'stream';
import { promisify } from 'util';
import Axios from 'axios';
import { createWriteStream } from 'fs';

const finished = promisify(stream.finished);

export async function downloadFile(
  fileUrl: string,
  outputLocationPath: string,
) {
  const writer = createWriteStream(outputLocationPath);

  const { data } = await Axios({
    method: 'get',
    url: fileUrl,
    responseType: 'stream',
  });
  data.pipe(writer);
  return finished(writer);
}
