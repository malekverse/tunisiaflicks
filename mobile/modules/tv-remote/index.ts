// The remote's OK as a tap on the player (android/: TvRemoteModule). TV builds only.
import { requireOptionalNativeModule } from 'expo'

const TvRemote = requireOptionalNativeModule<{ tapWebView(x: number, y: number): Promise<boolean> }>('TvRemote')

/** Taps the visible WebView at (x, y), fractions of its size. Resolves false when it couldn't. */
export function tapWebView(x = 0.5, y = 0.5): Promise<boolean> {
  return TvRemote?.tapWebView(x, y).catch(() => false) ?? Promise.resolve(false)
}
