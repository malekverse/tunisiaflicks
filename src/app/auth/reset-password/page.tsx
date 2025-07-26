import { Suspense } from 'react';
import ResetPasswordForm from './reset-password-form';

// Server component that uses Suspense to wrap the client component
export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-[350px] h-[500px] bg-gray-800 rounded-lg animate-pulse">
          <div className="p-6">
            <div className="h-8 bg-gray-700 rounded w-3/4 mb-4"></div>
            <div className="h-4 bg-gray-700 rounded w-1/2 mb-8"></div>
            <div className="h-10 bg-gray-700 rounded mb-4"></div>
            <div className="h-10 bg-gray-700 rounded mb-8"></div>
            <div className="h-10 bg-gray-700 rounded"></div>
          </div>
        </div>
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}