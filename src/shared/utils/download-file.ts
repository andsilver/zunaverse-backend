import Axios from 'axios';
import fs from 'fs';

export async function downloadFile(
  url: string,
  filepath: string,
): Promise<string> {
  const response = await Axios({
    url,
    method: 'GET',
    responseType: 'stream',
  });
  return new Promise((resolve, reject) => {
    response.data
      .pipe(fs.createWriteStream(filepath))
      .on('error', reject)
      .once('close', () => resolve(filepath));
  });
}
