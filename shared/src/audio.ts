/** Upload formats the brief names; the server still validates the content, not the name. */
export const AUDIO_EXTENSIONS = ['.wav', '.mp3', '.m4a'] as const

/** Value for a file input's `accept` attribute. */
export const AUDIO_ACCEPT = AUDIO_EXTENSIONS.join(',')

export function isAudioExtension(ext: string): boolean {
  return (AUDIO_EXTENSIONS as readonly string[]).includes(ext.toLowerCase())
}
