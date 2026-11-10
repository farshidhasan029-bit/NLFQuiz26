import baulcEmblem from "@razzia/web/assets/baulc_emblem.png"
import { getBranding } from "@razzia/web/branding"
import type { PropsWithChildren } from "react"

const Background = ({ children }: PropsWithChildren) => {
  const branding = getBranding()
  const appName = branding?.appName ?? "NLF26"

  return (
    <section className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-slate-950 via-[#0a0e1a] to-[#0f172a] px-4 py-8 text-slate-100">
      {/* Dynamic Ambient Glowing Orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="animate-orb-1 absolute -top-[15vmin] -left-[15vmin] h-[70vmin] w-[70vmin] rounded-full bg-indigo-600/25 blur-[110px]" />
        <div className="animate-orb-2 absolute -right-[15vmin] -bottom-[15vmin] h-[65vmin] w-[65vmin] rounded-full bg-purple-600/20 blur-[110px]" />
        <div className="animate-orb-3 absolute top-1/2 left-1/3 h-[45vmin] w-[45vmin] -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-500/15 blur-[95px]" />
        {/* Sleek cyber grid pattern */}
        <div className="bg-grid-pattern absolute inset-0 opacity-40" />
        {/* Subtle radial vignette */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(5,7,15,0.7)_100%)]" />
      </div>

      <div className="z-10 flex flex-col items-center">
        {branding?.logo ? (
          <img
            src={branding.logo}
            className="mb-8 h-18 sm:h-20 w-auto select-none drop-shadow-[0_6px_20px_rgba(99,102,241,0.3)]"
            alt={appName}
          />
        ) : (
          <div className="mb-8 flex items-center gap-3.5 select-none transition-transform duration-300 hover:scale-105 drop-shadow-[0_6px_20px_rgba(99,102,241,0.3)]">
            {/* BAULC Emblem in pristine white rounded badge */}
            <div className="flex size-16 sm:size-18 shrink-0 items-center justify-center rounded-2xl bg-white p-1.5 shadow-xl shadow-indigo-950/40 border border-white/80">
              <img
                src={baulcEmblem}
                className="size-full object-contain"
                alt="BAULC"
              />
            </div>
            {/* Beside that: NLF 26 */}
            <div className="flex items-baseline font-black tracking-tight">
              <span className="text-4xl sm:text-5xl font-black text-white drop-shadow-[0_2px_10px_rgba(255,255,255,0.25)]">
                NLF
              </span>
              <span className="ml-2 text-4xl sm:text-5xl font-black bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-500 bg-clip-text text-transparent drop-shadow-[0_2px_10px_rgba(99,102,241,0.4)]">
                26
              </span>
            </div>
          </div>
        )}
        {children}
      </div>

      <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 text-xs font-medium text-slate-400/80">
        <span className="inline-block size-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
        {/* oxlint-disable-next-line no-undef */}
        <span>NLF26 • v{__APP_VERSION__}</span>
      </div>
    </section>
  )
}

export default Background
