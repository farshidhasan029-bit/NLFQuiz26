import clsx from "clsx"
import {
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type KeyboardEvent,
} from "react"
import { useTranslation } from "react-i18next"

interface Props {
  value: string
  onChange: (_value: string) => void
  length?: number
  className?: string
}

const PinInput = ({ value, onChange, length = 6, className }: Props) => {
  const { t } = useTranslation()
  const refs = useRef<Array<HTMLInputElement | null>>([])
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null)

  const padded = value.padEnd(length, " ").slice(0, length)
  const digits = Array.from({ length }, (_, i) => padded[i].trim())

  const focus = (index: number) => {
    refs.current[Math.max(0, Math.min(length - 1, index))]?.focus()
  }

  const update = (index: number, char: string) => {
    const next = padded.split("")
    next[index] = char || " "
    onChange(next.join("").trimEnd())
  }

  const handleKeyDown =
    (index: number) => (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Backspace") {
        e.preventDefault()

        if (digits[index]) {
          update(index, "")
        } else {
          focus(index - 1)
        }

        return
      }

      if (e.key === "ArrowLeft") {
        focus(index - 1)

        return
      }

      if (e.key === "ArrowRight") {
        focus(index + 1)
      }
    }

  const handleChange =
    (index: number) => (e: ChangeEvent<HTMLInputElement>) => {
      const char = e.target.value.replace(/\D/gu, "").slice(-1)

      if (!char) {
        return
      }

      update(index, char)
      focus(index + 1)
    }

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    const pasted = e.clipboardData
      .getData("text")
      .replace(/\D/gu, "")
      .slice(0, length)
    onChange(pasted)
    focus(pasted.length < length ? pasted.length : length - 1)
  }

  return (
    <div className={clsx("flex justify-center items-center gap-2 sm:gap-2.5 py-2 w-full", className)}>
      {digits.map((digit, i) => {
        const isFilled = Boolean(digit)
        const isFocused = focusedIndex === i
        const isNextToFill =
          !digit &&
          (i === 0 || Boolean(digits[i - 1])) &&
          !digits.slice(i).some(Boolean)

        return (
          <input
            key={i}
            ref={(el) => {
              refs.current[i] = el
            }}
            type="text"
            inputMode="numeric"
            aria-label={t("game:pinDigit", { position: i + 1 })}
            maxLength={1}
            value={digit}
            onFocus={() => setFocusedIndex(i)}
            onBlur={() => setFocusedIndex(null)}
            onChange={handleChange(i)}
            onKeyDown={handleKeyDown(i)}
            onPaste={handlePaste}
            className={clsx(
              "h-14 sm:h-16 w-10 sm:w-12 max-w-13 min-w-0 flex-1 rounded-xl border-2 text-center font-mono text-2xl sm:text-3xl font-black outline-none transition-all duration-150 select-none",
              isFilled
                ? "border-primary bg-primary/10 text-primary ring-2 ring-primary/30 shadow-md shadow-primary/20 scale-105"
                : isFocused
                  ? "border-primary ring-4 ring-primary/25 bg-primary/5 scale-105 text-primary"
                  : isNextToFill
                    ? "border-primary/60 ring-2 ring-primary/20 bg-primary/[0.03] animate-pulse text-gray-500"
                    : "border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-400 hover:border-gray-300",
            )}
          />
        )
      })}
    </div>
  )
}

export default PinInput
