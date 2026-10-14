/** URL publique d'un média : visuels provisoires statiques ou fichiers envoyés (servis par /media/…). */
export function mediaUrl(filePath: string): string {
  return filePath.startsWith("/") ? filePath : `/media/${filePath}`;
}
