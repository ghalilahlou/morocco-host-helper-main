import * as React from "react"
import {
  MOBILE_BREAKPOINT,
  TABLET_BREAKPOINT,
  MOBILE_MEDIA_QUERY,
  getIsMobile,
} from "@/lib/breakpoints"

/**
 * Détection « mobile » alignée sur les media queries CSS (matchMedia).
 *
 * ✅ Initialisation SYNCHRONE via getIsMobile() : le premier rendu est déjà
 * correct → plus de flash / saut de layout (cf. REFONTE_MOBILE_FRONTEND.md §1.1).
 */
export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean>(getIsMobile)

  React.useEffect(() => {
    const mql = window.matchMedia(MOBILE_MEDIA_QUERY)
    const onChange = () => setIsMobile(mql.matches)
    mql.addEventListener("change", onChange)
    onChange()
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return isMobile
}

function getIsTablet(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false
  }
  return window.matchMedia(
    `(min-width: ${MOBILE_BREAKPOINT}px) and (max-width: ${TABLET_BREAKPOINT - 1}px)`
  ).matches
}

export function useIsTablet() {
  const [isTablet, setIsTablet] = React.useState<boolean>(getIsTablet)

  React.useEffect(() => {
    const mql = window.matchMedia(
      `(min-width: ${MOBILE_BREAKPOINT}px) and (max-width: ${TABLET_BREAKPOINT - 1}px)`
    )
    const onChange = () => setIsTablet(mql.matches)
    mql.addEventListener("change", onChange)
    onChange()
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return isTablet
}

function getDeviceType(): 'mobile' | 'tablet' | 'desktop' {
  if (typeof window === "undefined") return 'desktop'
  if (getIsMobile()) return 'mobile'
  if (getIsTablet()) return 'tablet'
  return 'desktop'
}

export function useDeviceType() {
  const [deviceType, setDeviceType] = React.useState<'mobile' | 'tablet' | 'desktop'>(getDeviceType)

  React.useEffect(() => {
    const updateDeviceType = () => setDeviceType(getDeviceType())
    updateDeviceType()
    window.addEventListener("resize", updateDeviceType)
    return () => window.removeEventListener("resize", updateDeviceType)
  }, [])

  return deviceType
}
