import Reconnect from "@razzia/web/features/game/components/join/Reconnect"
import Room from "@razzia/web/features/game/components/join/Room"
import Username from "@razzia/web/features/game/components/join/Username"
import { usePlayerStore } from "@razzia/web/features/game/stores/player"
import { createFileRoute, useSearch } from "@tanstack/react-router"
import { useEffect } from "react"

const PlayerAuthPage = () => {
  const { inviteCode, updatePlayer } = usePlayerStore()
  const { pin } = useSearch({ from: "/(auth)/" })

  // If the URL contains a ?pin= (e.g. from QR scan), it must always win over
  // whatever invite code is currently stored in localStorage / the store.
  // Without this, a returning participant scans a new QR and gets
  // "Game not found" because Username still sends their old pin.
  useEffect(() => {
    if (!pin) return
    if (pin === inviteCode) return   // already correct — nothing to do

    // Clear the stale stored pin and let Room pick up the URL pin
    localStorage.removeItem("game_pin")
    localStorage.removeItem("game_id")
    updatePlayer({ inviteCode: null, generatedUsernames: false })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin])

  // Show pin-entry / QR-auto-join screen when no invite code is confirmed yet
  // (Room will auto-submit when ?pin= is present in the URL)
  if (!inviteCode) {
    return (
      <>
        <Room />
        <Reconnect />
      </>
    )
  }

  return <Username />
}

export const Route = createFileRoute("/(auth)/")({
  component: PlayerAuthPage,
})
