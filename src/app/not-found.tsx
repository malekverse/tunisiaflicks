"use client";
import { Suspense } from 'react';

export default function NotFound() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <NotFoundComponent />
    </Suspense>
  );
}

function NotFoundComponent() {
  return (
    <div className='flex flex-col justify-center items-center h-[80%]'>
      <div className='text-7xl text-red-500 font-bold'>404</div>
      <div>Page not found</div>
    </div>
  );
}