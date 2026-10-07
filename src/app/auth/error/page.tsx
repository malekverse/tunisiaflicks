'use client';

import { useEffect } from 'react'
import { Button } from "@/src/components/ui/button"
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/src/components/ui/card"
import { AlertCircle } from 'lucide-react'
import { Alert, AlertDescription } from "@/src/components/ui/alert"
import { useT } from '@/src/components/I18nProvider'

export default function AuthError() {
  const router = useRouter()
  const t = useT()
  
  // Use window.location.search directly instead of useSearchParams
  const getErrorMessage = () => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      return params.get('error')
    }
    return null
  }

  useEffect(() => {
    const error = getErrorMessage()
    if (error) {
      console.error("Authentication error:", error)
    }
  }, [])

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <Card className="w-[350px]">
        <CardHeader>
          <CardTitle>{t('auth.errorTitle')}</CardTitle>
          <CardDescription>{t('auth.errorDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {getErrorMessage() || t('auth.errorFallback')}
            </AlertDescription>
          </Alert>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button onClick={() => router.push('/login')}>{t('auth.tryAgain')}</Button>
          <Button variant="outline" onClick={() => router.push('/')}>
            {t('auth.returnHome')}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}

