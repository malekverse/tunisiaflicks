"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { Button } from "@/src/components/ui/button"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/src/components/ui/form"
import { Input } from "@/src/components/ui/input"
import { toast } from "@/src/hooks/use-toast"
import { updateProfile } from "./actions"
import AvatarUpload from "./AvatarUpload"
import { useT } from "@/src/components/I18nProvider"
import type { Translate } from "@/src/lib/i18n"

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

  async function onSubmit(data: ProfileFormValues) {
    setIsLoading(true)

    try {
      const result = await updateProfile(data)
      if ('error' in result) {
        toast({
          title: t("common.error"),
          description: t(result.error === 'emailTaken' ? "account.emailTaken" : "profile.updateFailed"),
          variant: "destructive",
        })
        return
      }
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

        <div className="flex justify-end border-t border-white/[0.07] pt-5">
          <Button type="submit" disabled={isLoading} className="max-sm:w-full">
            {isLoading ? t("profile.updating") : t("profile.update")}
          </Button>
        </div>
      </form>
    </Form>
  )
}
