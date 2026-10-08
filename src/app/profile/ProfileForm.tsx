"use client"

import { useId, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { AnimatePresence, m } from "framer-motion"
import { LockKeyhole } from "lucide-react"
import * as z from "zod"
import { Button } from "@/src/components/ui/button"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/src/components/ui/form"
import { Input } from "@/src/components/ui/input"
import { Label } from "@/src/components/ui/label"
import { toast } from "@/src/hooks/use-toast"
import { useAccount } from "@/src/hooks/use-account"
import { tween } from "@/src/lib/motion"
import { updateProfile } from "./actions"
import AvatarUpload from "./AvatarUpload"
import { ReauthNotice, useFreshLogin } from "./AccountSecurity"
import { useT } from "@/src/components/I18nProvider"
import type { Translate } from "@/src/lib/i18n/translate"

const phoneRegex = new RegExp(
  /^([+]?[\s0-9]+)?(\d{3}|[(]?[0-9]+[)])?([-]?[\s]?[0-9])+$/
)

// Built per language so the validation messages are translated.
const profileFormSchema = (t: Translate) => z.object({
  name: z.string().min(2, {
    message: t("profile.nameMin"),
  }),
  email: z.string().email({
    message: t("profile.emailInvalid"),
  }),
  // Phone and birthdate are optional: empty is fine, but if filled they must be valid.
  phone: z.string().refine((value) => value === "" || phoneRegex.test(value), t("profile.phoneInvalid")),
  birthdate: z.string().refine((date) => date === "" || new Date(date) < new Date(), {
    message: t("profile.birthdatePast"),
  }),
})

type ProfileFormValues = z.infer<ReturnType<typeof profileFormSchema>>

interface User {
  name?: string;
  email?: string;
  phone?: string;
  birthdate?: string;
  image?: string;
}

export default function ProfileForm({ user }: { user: User }) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const t = useT()
  const schema = useMemo(() => profileFormSchema(t), [t])

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: user.name || "",
      email: user.email || "",
      phone: user.phone || "",
      birthdate: user.birthdate || "",
    },
  });

  // Changing the login email needs proof it's the owner: the current password, or (Google-only
  // accounts) a sign-in from the last few minutes. The field only appears once the email changes.
  const passwordId = useId()
  const passwordInput = useRef<HTMLInputElement>(null)
  const { account } = useAccount()
  const freshLogin = useFreshLogin()
  const [currentPassword, setCurrentPassword] = useState("")
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [reauthRequired, setReauthRequired] = useState(false)
  const emailValue = form.watch("email")
  const emailChanged = !!emailValue?.trim() && emailValue.trim().toLowerCase() !== (user.email ?? "").trim().toLowerCase()
  // Until the account has loaded, assume a password (most accounts have one).
  const hasPassword = account ? account.hasPassword : true
  const needsReauth = !hasPassword && (reauthRequired || !freshLogin)

  async function onSubmit(data: ProfileFormValues) {
    setPasswordError(null)
    if (emailChanged && hasPassword && !currentPassword) {
      setPasswordError(t("auth.err.password"))
      passwordInput.current?.focus()
      return
    }
    setIsLoading(true)

    try {
      const result = await updateProfile(emailChanged ? { ...data, currentPassword } : data)
      if ('error' in result) {
        if (result.error === 'wrongPassword') {
          setPasswordError(t("account.wrongPassword"))
          passwordInput.current?.focus()
          return
        }
        if (result.error === 'reauth') {
          setReauthRequired(true)
          return
        }
        toast({
          title: t("common.error"),
          description: t(
            result.error === 'emailTaken' ? "account.emailTaken"
              : result.error === 'tv_session' ? "accountSecurity.tvSession"
                : result.error === 'rateLimited' ? "api.tooManyAttempts"
                  : "profile.updateFailed"
          ),
          variant: "destructive",
        })
        return
      }
      setCurrentPassword("")
      toast({
        title: t("profile.updated"),
        description: result.emailChanged ? t("verify.sentToNew") : t("profile.updatedDesc"),
      })
      router.refresh()
    } catch (error) {
      toast({
        title: t("common.error"),
        description: t("profile.updateFailed"),
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const label = "text-[13px] font-medium text-white/70"
  const hint = "text-[12.5px] leading-snug text-white/45"
  const error = "text-[13px] font-normal text-red-400"
  const input = "text-base sm:text-[15px]"

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-8">
        <AvatarUpload user={user} />

        <div className="grid gap-x-5 gap-y-6 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel className={label}>{t("profile.name")}</FormLabel>
                <FormControl>
                  <Input placeholder={t("profile.namePlaceholder")} autoComplete="name" className={input} {...field} />
                </FormControl>
                <FormDescription className={hint}>
                  {t("profile.nameDesc")}
                </FormDescription>
                <FormMessage className={error} />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel className={label}>{t("profile.email")}</FormLabel>
                <FormControl>
                  <Input type="email" dir="ltr" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false} placeholder={t("profile.emailPlaceholder")} className={`${input} rtl:text-end`} {...field} />
                </FormControl>
                <FormDescription className={hint}>
                  {t("profile.emailDesc")}
                </FormDescription>
                <FormMessage className={error} />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel className={label}>{t("profile.phone")}</FormLabel>
                <FormControl>
                  <Input type="tel" dir="ltr" inputMode="tel" autoComplete="tel" placeholder={t("profile.phonePlaceholder")} className={`${input} rtl:text-end`} {...field} />
                </FormControl>
                <FormDescription className={hint}>
                  {t("profile.phoneDesc")}
                </FormDescription>
                <FormMessage className={error} />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="birthdate"
            render={({ field }) => (
              <FormItem>
                <FormLabel className={label}>{t("profile.birthdate")}</FormLabel>
                <FormControl>
                  <Input type="date" autoComplete="bday" className={`${input} [&::-webkit-calendar-picker-indicator]:opacity-60`} {...field} />
                </FormControl>
                <FormDescription className={hint}>
                  {t("profile.birthdateDesc")}
                </FormDescription>
                <FormMessage className={error} />
              </FormItem>
            )}
          />
        </div>

        <AnimatePresence initial={false}>
          {emailChanged && (hasPassword || needsReauth) && (
            <m.div
              key="confirm-email"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0, transition: tween.base }}
              exit={{ opacity: 0, y: -6, transition: tween.fast }}
            >
              {hasPassword ? (
                <div className="grid gap-x-5 gap-y-3 rounded-2xl bg-white/[0.03] p-4 ring-1 ring-inset ring-white/[0.06] sm:grid-cols-2 sm:items-center sm:p-5">
                  <div className="flex items-start gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/[0.07] text-white/80">
                      <LockKeyhole aria-hidden className="h-[18px] w-[18px]" strokeWidth={1.9} />
                    </span>
                    <div className="min-w-0">
                      <Label htmlFor={passwordId} className="text-[14px] font-semibold text-white">{t("account.currentPassword")}</Label>
                      <p id={`${passwordId}-hint`} className="mt-0.5 text-[13px] leading-snug text-white/55">{t("accountSecurity.emailPasswordHint")}</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Input
                      ref={passwordInput}
                      id={passwordId}
                      type="password"
                      autoComplete="current-password"
                      className={input}
                      value={currentPassword}
                      onChange={(event) => { setCurrentPassword(event.target.value); setPasswordError(null) }}
                      aria-invalid={!!passwordError}
                      aria-describedby={`${passwordId}-hint${passwordError ? ` ${passwordId}-error` : ""}`}
                    />
                    {passwordError && <p id={`${passwordId}-error`} role="alert" className={error}>{passwordError}</p>}
                  </div>
                </div>
              ) : (
                <ReauthNotice message={t("accountSecurity.reauthEmail")} callbackUrl="/profile#account" />
              )}
            </m.div>
          )}
        </AnimatePresence>

        <div className="flex justify-end border-t border-white/[0.07] pt-5">
          <Button type="submit" disabled={isLoading} className="max-sm:w-full">
            {isLoading ? t("profile.updating") : t("profile.update")}
          </Button>
        </div>
      </form>
    </Form>
  )
}
