import { describe, expect, it } from 'vitest'
import {
  PHOTOGRAPHER_PICKER_DIALOG_DESKTOP_H_BOOK,
  PHOTOGRAPHER_PICKER_DIALOG_DESKTOP_H_COMPACT,
} from './photographerPickerDialogClasses'

describe('photographerPickerDialogClasses', () => {
  it('pins full-screen below xl and restores inset modal on xl+', () => {
    for (const cls of [
      PHOTOGRAPHER_PICKER_DIALOG_DESKTOP_H_BOOK,
      PHOTOGRAPHER_PICKER_DIALOG_DESKTOP_H_COMPACT,
    ]) {
      expect(cls).toContain('h-[100dvh]')
      expect(cls).toContain('w-screen')
      expect(cls).toContain('max-w-none')
      expect(cls).toContain('!left-0')
      expect(cls).toContain('!top-0')
      expect(cls).toContain('!translate-x-0')
      expect(cls).toContain('!translate-y-0')
      expect(cls).toContain('rounded-none')
      expect(cls).toContain('xl:max-w-6xl')
      expect(cls).toContain('xl:w-[96vw]')
      // Desktop must beat the important full-screen tablet defaults in the CSS cascade.
      expect(cls).toContain('xl:!left-[50%]')
      expect(cls).toContain('xl:!top-[50%]')
      expect(cls).toContain('xl:!translate-x-[-50%]')
      expect(cls).toContain('xl:!translate-y-[-50%]')
      expect(cls).toContain('xl:rounded-2xl')
    }
  })

  it('keeps Book 52rem and compact 48rem desktop height caps', () => {
    expect(PHOTOGRAPHER_PICKER_DIALOG_DESKTOP_H_BOOK).toContain('xl:h-[min(88dvh,52rem)]')
    expect(PHOTOGRAPHER_PICKER_DIALOG_DESKTOP_H_COMPACT).toContain('xl:h-[min(88dvh,48rem)]')
  })
})

