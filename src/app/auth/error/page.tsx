'use client';

import { useEffect } from 'react'
import { Button } from "@/src/components/ui/button"
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/src/components/ui/card"
import { AlertCircle } from 'lucide-react'
import { Alert, AlertDescription } from "@/src/components/ui/alert"

export default function AuthError() {
  const router = useRouter()
  
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
          <CardTitle>Authentication Error</CardTitle>
          <CardDescription>An error occurred during authentication</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {getErrorMessage() || "An unexpected error occurred during authentication."}
            </AlertDescription>
          </Alert>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button onClick={() => router.push('/login')}>Try Again</Button>
          <Button variant="outline" onClick={() => router.push('/')}>
            Return to Home
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}

