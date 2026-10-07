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

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <AvatarUpload user={user} />
        
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("profile.name")}</FormLabel>
              <FormControl>
                <Input placeholder={t("profile.namePlaceholder")} {...field} />
              </FormControl>
              <FormDescription>
                {t("profile.nameDesc")}
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("profile.email")}</FormLabel>
              <FormControl>
                <Input placeholder={t("profile.emailPlaceholder")} {...field} />
              </FormControl>
              <FormDescription>
                {t("profile.emailDesc")}
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("profile.phone")}</FormLabel>
              <FormControl>
                <Input placeholder={t("profile.phonePlaceholder")} {...field} />
              </FormControl>
              <FormDescription>
                {t("profile.phoneDesc")}
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="birthdate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("profile.birthdate")}</FormLabel>
              <FormControl>
                <Input type="date" {...field} />
              </FormControl>
              <FormDescription>
                {t("profile.birthdateDesc")}
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <Button type="submit" disabled={isLoading}>
          {isLoading ? t("profile.updating") : t("profile.update")}
        </Button>
      </form>
    </Form>
  )
}

