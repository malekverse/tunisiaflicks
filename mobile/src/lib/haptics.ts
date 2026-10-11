// The phone's small taps of the motor, named for what they mean. Nothing on TV (no motor in a remote).
import * as Haptics from 'expo-haptics'
import { isTV } from '@/theme/tokens'

const run = (fn: () => Promise<void>) => { if (!isTV) fn().catch(() => {}) }

export const haptics = {
  /** A light tap: a button that matters (Play, My List). */
  tap: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  /** A tick: a choice changed (a tab, a chip, the pull reaching its point). */
  tick: () => run(() => Haptics.selectionAsync()),
  /** A firmer press: something opened under your finger (the peek). */
  press: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  /** Done: added to My List. */
  success: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
}
