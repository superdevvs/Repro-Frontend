import React, { useEffect, useRef, useState } from 'react'
import { Check, Copy } from 'lucide-react'

import { cn } from '@/lib/utils'

interface HoverCopyValueProps {
  value?: string | null
  label: string
  as?: 'h3' | 'p' | 'span'
  className?: string
  textClassName?: string
  title?: string
}

export function HoverCopyValue({
  value,
  label,
  as: Tag = 'p',
  className,
  textClassName,
  title,
}: HoverCopyValueProps) {
  const text = value?.trim() ?? ''
  const [copied, setCopied] = useState(false)
  const resetTimer = useRef<number>()

  useEffect(() => () => window.clearTimeout(resetTimer.current), [])

  if (!text) return null

  const copy = async (event: React.SyntheticEvent) => {
    event.preventDefault()
    event.stopPropagation()
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.clearTimeout(resetTimer.current)
      resetTimer.current = window.setTimeout(() => setCopied(false), 1200)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className={cn('flex min-w-0 items-start gap-1 [&:hover>button]:opacity-100', className)}>
      <Tag className={cn('min-w-0', textClassName)} title={title ?? text}>
        {text}
      </Tag>
      <button
        type="button"
        className="mt-0.5 inline-flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded-sm text-muted-foreground opacity-0 transition-opacity hover:opacity-100 hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={`Copy ${label}`}
        title={`Copy ${label}`}
        onClick={copy}
        onPointerDown={(event) => event.stopPropagation()}
      >
        {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
      </button>
    </div>
  )
}
