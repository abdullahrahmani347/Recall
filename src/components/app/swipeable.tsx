'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'

interface SwipeAction {
  label: string
  onTrigger: () => void
  icon?: ReactNode
  color?: string // CSS color for the action background
}

interface SwipeableProps {
  children: ReactNode
  leftAction?: SwipeAction
  rightAction?: SwipeAction
  threshold?: number // px to trigger action (default 80)
}

/**
 * Swipeable — adds swipe gesture support to a list item.
 *
 * Swipe right → triggers rightAction (e.g., "Pin")
 * Swipe left → triggers leftAction (e.g., "Archive")
 *
 * Visual feedback: the action's label/icon slides in as the user swipes.
 * If the swipe doesn't cross the threshold, the item snaps back.
 *
 * Touch-only (doesn't interfere with mouse/keyboard).
 */
export function Swipeable({ children, leftAction, rightAction, threshold = 80 }: SwipeableProps) {
  const [offset, setOffset] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const startX = useRef(0)
  const startY = useRef(0)
  const isSwiping = useRef(false)

  const onTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX
    startY.current = e.touches[0].clientY
    isSwiping.current = false
  }

  const onTouchMove = (e: React.TouchEvent) => {
    const dx = e.touches[0].clientX - startX.current
    const dy = e.touches[0].clientY - startY.current

    // Only treat as swipe if horizontal movement > vertical
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 10) {
      isSwiping.current = true
      setIsDragging(true)
      setOffset(dx)
    }
  }

  const onTouchEnd = () => {
    setIsDragging(false)

    if (offset > threshold && rightAction) {
      // Swipe right — trigger right action
      rightAction.onTrigger()
    } else if (offset < -threshold && leftAction) {
      // Swipe left — trigger left action
      leftAction.onTrigger()
    }

    // Snap back
    setOffset(0)
  }

  return (
    <div
      className="relative overflow-hidden"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Left action (revealed on swipe right) */}
      {rightAction && offset > 0 && (
        <div
          className="absolute inset-y-0 left-0 flex items-center justify-center px-4"
          style={{ backgroundColor: rightAction.color || 'var(--accent-brand)', opacity: Math.min(offset / threshold, 1) }}
        >
          <span className="flex items-center gap-1.5 text-sm font-medium text-void">
            {rightAction.icon}
            {rightAction.label}
          </span>
        </div>
      )}

      {/* Right action (revealed on swipe left) */}
      {leftAction && offset < 0 && (
        <div
          className="absolute inset-y-0 right-0 flex items-center justify-center px-4"
          style={{ backgroundColor: leftAction.color || 'var(--accent-warm)', opacity: Math.min(-offset / threshold, 1) }}
        >
          <span className="flex items-center gap-1.5 text-sm font-medium text-void">
            {leftAction.icon}
            {leftAction.label}
          </span>
        </div>
      )}

      {/* The actual content */}
      <div
        style={{
          transform: `translateX(${offset}px)`,
          transition: isDragging ? 'none' : 'transform 200ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {children}
      </div>
    </div>
  )
}
