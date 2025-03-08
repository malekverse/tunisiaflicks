'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/src/components/ui/card';
import { useSession } from 'next-auth/react';

export default function SignUpPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const { data: session, status } = useSession();

  useEffect(() => {
    if (status === 'authenticated') {
      router.push('/dashboard'); // Redirect to dashboard if logged in
    }
  }, [status, router]);

  if (status === 'loading' || status === 'authenticated') {
    return <p>Loading...</p>; // Show a loader while checking auth state
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });

      if (response.ok) {
        router.push('/login');
      } else {
        const data = await response.json();
        setError(data.message || 'An error occurred during sign up');
      }
    } catch (error) {
      console.error('Signup error:', error);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900">
      <Card className="w-[350px] shadow-lg">
        <CardHeader>
          <CardTitle>Sign Up</CardTitle>
          <CardDescription>Create a new account</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <div className="grid w-full items-center gap-4">
              <div className="flex flex-col space-y-1.5">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="flex flex-col space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="flex flex-col space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>
            {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
            <Button type="submit" className="w-full mt-4" disabled={isLoading}>
              {isLoading ? 'Signing up...' : 'Sign Up'}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex justify-center">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Already have an account?{' '}
            <Link href="/login" className="text-blue-500 hover:underline">
              Login
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}