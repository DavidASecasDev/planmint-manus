import * as React from "react"
import { useRef, useCallback, createContext, useContext } from "react"
import { motion, useSpring, useTransform, useMotionValue, type MotionValue } from "framer-motion"
import { cn } from "@/lib/utils"

/*
 * DockContainer / DockItem — macOS-style magnification for sidebar items.
 *
 * IMPORTANT: The DockContainer wraps the entire menu list but the magnification
 * effect only applies to elements explicitly wrapped in <DockItem>.
 * Collapsible sub-menus and other content placed OUTSIDE a <DockItem> will
 * NOT be scaled, preventing the "block move" bug.
 */

const DockContext = createContext<{
  mouseY: MotionValue<number>
  enabled: boolean
}>({
  mouseY: null as any,
  enabled: true,
})

interface DockContainerProps {
  children: React.ReactNode
  className?: string
  enabled?: boolean
}

interface DockItemProps {
  children: React.ReactNode
  className?: string
}

const MAGNIFICATION = 0.35 // max extra scale (slightly reduced for subtlety)
const DISTANCE = 70 // px radius of effect

function DockItem({ children, className }: DockItemProps) {
  const ref = useRef<HTMLDivElement>(null)
  const { mouseY, enabled } = useContext(DockContext)

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

  return (
    <DockContext.Provider value={{ mouseY, enabled }}>
      <div
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className={className}
      >
        {children}
      </div>
    </DockContext.Provider>
  )
}

export { DockContainer, DockItem }
