import Link from 'next/link';

export default function NotFound() {
  return (
    <div className='flex flex-col justify-center items-center gap-2 w-full py-24 text-center'>
      <div className='text-7xl text-red-500 font-bold'>404</div>
      <div>Page not found</div>
      <Link href='/' className='mt-4 text-sm text-gray-400 hover:text-white underline'>Back to home</Link>
    </div>
  );
}
