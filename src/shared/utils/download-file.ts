import download from 'image-downloader';

export async function downloadFile(url: string, dest: string, timeout = 20000) {
  return download.image({
    url,
    dest,
    timeout,
  });
}
