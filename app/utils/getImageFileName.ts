export function getImageFileName(imgPath: string) {
  return imgPath.split('/').pop()
}
