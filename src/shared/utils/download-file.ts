import * as stream from 'stream';
import { promisify } from 'util';
import Axios from 'axios';
import { createWriteStream } from 'fs';

const finished = promisify(stream.finished);

export async function downloadFile(
  fileUrl: string,
  outputLocationPath: string,
): Promise<any> {
  const writer = createWriteStream(outputLocationPath);
  return Axios({
    method: 'get',
    url: fileUrl,
    responseType: 'stream',
  }).then((response) => {
    response.data.pipe(writer);
    return finished(writer);
  });
}
