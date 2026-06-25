export type PwaInstallState =
  | 'installed'
  | 'prompt'
  | 'ios-manual'
  | 'manual'

export function getPwaInstallState({
  installed,
  ios,
  promptAvailable,
}: {
  installed: boolean
  ios: boolean
  promptAvailable: boolean
}): PwaInstallState {
  if (installed) return 'installed'
  if (promptAvailable) return 'prompt'
  if (ios) return 'ios-manual'
  return 'manual'
}
