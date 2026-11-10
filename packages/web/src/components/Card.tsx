import clsx from "clsx"
import { type PropsWithChildren } from "react"
import { twMerge } from "tailwind-merge"

type Props = {
  className?: string
} & PropsWithChildren

const Card = ({ children, className }: Props) => (
  <div
    className={twMerge(
      clsx(
        "bg-background z-10 flex w-full max-w-[92vw] sm:max-w-[440px] flex-col rounded-3xl p-6 sm:p-7 shadow-2xl shadow-indigo-950/30 border border-slate-100/80 transition-all",
        className,
      ),
    )}
  >
    {children}
  </div>
)

export default Card
