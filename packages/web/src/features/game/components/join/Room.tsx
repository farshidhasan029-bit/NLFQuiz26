import Button from "@razzia/web/components/Button"
import Card from "@razzia/web/components/Card"
import PinInput from "@razzia/web/components/PinInput"
import { checkInviteCode } from "@razzia/web/features/game/queries"
import { usePlayerStore } from "@razzia/web/features/game/stores/player"
import { ApiError } from "@razzia/web/lib/api"
import { useMutation } from "@tanstack/react-query"
import { useSearch } from "@tanstack/react-router"
import { KeyRound } from "lucide-react"
import { type SubmitEvent, useEffect, useRef, useState } from "react"
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"

const Room = () => {
  const { updatePlayer } = usePlayerStore()
  const [invitation, setInvitation] = useState("")
  const { pin } = useSearch({ from: "/(auth)/" })
  const hasCheckedRef = useRef(false)
  const { t } = useTranslation()

  const { mutate: check, isPending } = useMutation({
    mutationFn: checkInviteCode,
    onSuccess: ({ generatedUsernames }, code) => {
      updatePlayer({ inviteCode: code, generatedUsernames })
    },
    onError: (error) => {
      toast.error(
        t(error instanceof ApiError ? error.key : "errors:route.description"),
      )
    },
  })

  const handleJoin = (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault()
    check(invitation.replace(/\s/gu, ""))
  }

  useEffect(() => {
    if (!pin || hasCheckedRef.current) {
      return
    }

    hasCheckedRef.current = true
    check(pin)
  }, [pin, check])

  return (
    <Card className="w-full max-w-[92vw] sm:max-w-[440px]">
      <form onSubmit={handleJoin} className="flex flex-col">
        <div className="mb-4 flex items-center justify-center">
          <div className="flex items-center gap-2 rounded-xl bg-primary/10 px-4 py-1.5 border border-primary/25 shadow-sm">
            <KeyRound className="size-4 text-primary" />
            <p className="text-sm font-extrabold text-primary tracking-wide">
              {t("game:pinLabel")}
            </p>
          </div>
        </div>
        <PinInput value={invitation} onChange={setInvitation} />
        <Button type="submit" className="mt-5" disabled={isPending}>
          {t("common:submit")}
        </Button>
      </form>
    </Card>
  )
}

export default Room
