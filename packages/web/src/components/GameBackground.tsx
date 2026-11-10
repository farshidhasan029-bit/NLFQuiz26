import defaultBackground from "@razzia/web/assets/background.png"
import { getBranding, imageFallback } from "@razzia/web/branding"

const GameBackground = () => {
  const customBackground = getBranding()?.background

  if (customBackground) {
    return (
      <div className="fixed top-0 left-0 h-full w-full overflow-hidden">
        <img
          className="pointer-events-none h-full w-full object-cover select-none"
          src={customBackground}
          onError={imageFallback(defaultBackground)}
          alt="background"
        />
      </div>
    )
  }

  return (
    <div className="pointer-events-none fixed top-0 left-0 h-full w-full select-none overflow-hidden bg-gradient-to-br from-slate-950 via-[#080d1a] to-[#0d1424]">
      {/* Dynamic Ambient Glowing Orbs */}
      <div className="animate-orb-1 absolute -top-[10vmin] -left-[10vmin] h-[80vmin] w-[80vmin] rounded-full bg-indigo-600/25 blur-[120px]" />
      <div className="animate-orb-2 absolute -right-[10vmin] -bottom-[10vmin] h-[75vmin] w-[75vmin] rounded-full bg-purple-600/25 blur-[120px]" />
      <div className="animate-orb-3 absolute top-1/2 left-1/2 h-[60vmin] w-[60vmin] -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-600/15 blur-[110px]" />

      {/* Modern Cyber Grid Texture */}
      <div className="bg-grid-pattern absolute inset-0 opacity-40" />

      {/* Subtle Vignette Gradient for Depth */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(5,8,18,0.75)_100%)]" />
    </div>
  )
}

export default GameBackground
