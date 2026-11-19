import {
  getHosts,
  registerHost,
  removeHost,
} from "@razzia/web/features/manager/queries"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Trash2, UserPlus, Users } from "lucide-react"
import { useState } from "react"
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"

const ConfigHosts = () => {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const [newUsername, setNewUsername] = useState("")
  const [newPassword, setNewPassword] = useState("")

  const { data, isLoading } = useQuery({
    queryKey: ["hosts"],
    queryFn: getHosts,
  })

  const { mutate: doRegister, isPending: registering } = useMutation({
    mutationFn: registerHost,
    onSuccess: (host) => {
      queryClient.invalidateQueries({ queryKey: ["hosts"] })
      toast.success(t("manager:hosts.created", { username: host.username }))
      setNewUsername("")
      setNewPassword("")
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const { mutate: doRemove } = useMutation({
    mutationFn: removeHost,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hosts"] })
      toast.success(t("manager:hosts.deleted"))
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const handleCreate = () => {
    if (!newUsername.trim() || !newPassword.trim()) return
    doRegister({ username: newUsername.trim(), password: newPassword.trim() })
  }

  return (
    <div className="flex flex-col gap-4 py-2">
      {/* Existing hosts */}
      <div className="rounded-xl border p-4 flex flex-col gap-3">
        <h3 className="text-sm font-semibold flex items-center gap-1.5">
          <Users className="size-4" />
          {t("manager:hosts.title")}
        </h3>
        {isLoading ? (
          <p className="text-xs text-muted-foreground">{t("common:loading")}</p>
        ) : !data?.hosts.length ? (
          <p className="text-xs text-muted-foreground">{t("manager:hosts.none")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {data.hosts.map((host) => (
              <li
                key={host.id}
                className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
              >
                <span className="font-medium">{host.username}</span>
                <button
                  onClick={() => doRemove(host.id)}
                  className="text-destructive hover:opacity-70 p-1 rounded"
                  title={t("manager:hosts.delete")}
                >
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Create new host */}
      <div className="rounded-xl border p-4 flex flex-col gap-2">
        <h3 className="text-sm font-semibold flex items-center gap-1.5">
          <UserPlus className="size-4" />
          {t("manager:hosts.addTitle")}
        </h3>
        <input
          type="text"
          placeholder={t("manager:usernamePlaceholder")}
          value={newUsername}
          onChange={(e) => setNewUsername(e.target.value)}
          className="rounded-lg border px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 bg-background"
          autoComplete="off"
        />
        <input
          type="password"
          placeholder={t("manager:passwordPlaceholder")}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className="rounded-lg border px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 bg-background"
          autoComplete="new-password"
          onKeyDown={(e) => e.key === "Enter" && handleCreate()}
        />
        <button
          onClick={handleCreate}
          disabled={registering || !newUsername.trim() || !newPassword.trim()}
          className="mt-1 self-start rounded-lg bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {registering ? t("manager:hosts.creating") : t("manager:hosts.createBtn")}
        </button>
      </div>
    </div>
  )
}

export default ConfigHosts
