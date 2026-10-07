"use client"
import React, { useState } from 'react'

/** Long text clamped to a few lines with a "Read more / Show less" toggle (only when it's long). */
export default function ExpandableText({ text, lines = 5, threshold = 420 }: { text: string, lines?: number, threshold?: number }) {
  const [expanded, setExpanded] = useState(false)
  const isLong = text.length > threshold

  return (
    <div>
      <p
        className="whitespace-pre-line text-gray-600 dark:text-gray-300 leading-relaxed"
        style={!expanded && isLong ? { display: '-webkit-box', WebkitLineClamp: lines, WebkitBoxOrient: 'vertical', overflow: 'hidden' } : undefined}
      >
        {text}
      </p>
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="mt-2 text-sm font-medium text-red-500 hover:text-red-400"
        >
          {expanded ? 'Show less' : 'Read more'}
        </button>
      )}
    </div>
  )
}
