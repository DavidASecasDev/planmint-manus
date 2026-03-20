import * as React from "react"
import { useRef, useState, useCallback } from "react"
import { motion, useSpring, useTransform, useMotionValue, type MotionValue } from "framer-motion"
import { cn } from "@/lib/utils"

interface DockContainerProps {
  children: React.ReactNode
  className?: string
  enabled?: boolean
}

interface DockItemProps {
  children: React.ReactNode
  className?: string
  mouseY: MotionValue<number>
  enabled?: boolean
}

const MAGNIFICATION = 0.4 // max extra scale
const DISTANCE = 80 // px radius of effect

function DockItem({ children, className, mouseY, enabled = true }: DockItemProps) {
  const ref = useRef<HTMLDivElement>(null)

  const distance = useTransform<number, number>(mouseY, (val) => {
    if (!ref.current || val < 0) return DISTANCE + 1
    const rect = ref.current.getBoundingClientRect()
    const centerY = rect.top + rect.height / 2
    return Math.abs(val - centerY)
  })

  const scaleVal = useTransform<number, number>(distance, (d) => {
    if (!enabled) return 1
    return 1 + MAGNIFICATION * Math.max(0, 1 - d / DISTANCE)
  })

  const scale = useSpring(scaleVal as any, {
    stiffness: 300,
    damping: 25,
    mass: 0.5,
  })

  return (
    <motion.div
      ref={ref}
      style={{ scale: scale as any }}
      className={cn("origin-center", className)}
    >
      {children}
    </motion.div>
  )
}

function DockContainer({ children, className, enabled = true }: DockContainerProps) {
  const mouseY = useMotionValue(-1)

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (enabled) mouseY.set(e.clientY)
    },
    [enabled, mouseY]
  )

  const handleMouseLeave = useCallback(() => {
    mouseY.set(-1)
  }, [mouseY])

  // Inject mouseY into children
  const enhancedChildren = React.Children.map(children, (child) => {
    if (!React.isValidElement(child)) return child
    return (
      <DockItem mouseY={mouseY} enabled={enabled}>
        {child}
      </DockItem>
    )
  })

  return (
    <div
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={className}
    >
      {enhancedChildren}
    </div>
  )
}

export { DockContainer, DockItem }
