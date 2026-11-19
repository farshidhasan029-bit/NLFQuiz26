import Button from "@razzia/web/components/Button"
import Card from "@razzia/web/components/Card"
import Input from "@razzia/web/components/Input"
import { type KeyboardEvent, useState } from "react"
import { useTranslation } from "react-i18next"

interface Props {
  onSubmit: (_credentials: { username: string; password: string }) => void
  disabled?: boolean
}

const ManagerPassword = ({ onSubmit, disabled }: Props) => {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const { t } = useTranslation()

  const handleSubmit = () => {
    if (disabled) return
    onSubmit({ username, password })
  }

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Enter") {
      handleSubmit()
    }
  }

  return (
    <Card>
      <Input
        type="text"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={t("manager:usernamePlaceholder")}
        className="mb-2"
        autoComplete="username"
      />
      <Input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={t("manager:passwordPlaceholder")}
        autoComplete="current-password"
      />
      <Button className="mt-4" onClick={handleSubmit}>
        {t("common:submit")}
      </Button>
    </Card>
  )
}

export default ManagerPassword
