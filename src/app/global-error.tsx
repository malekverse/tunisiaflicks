"use client";

import { useEffect } from 'react';
import { reportError } from '@/src/lib/report-error';

// Last-resort boundary for errors in the root layout itself (error.tsx can't catch those). It
// replaces the whole document, so it has its own <html> and can't use the i18n provider: the
// message is shown in English and Arabic.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }, reset: () => void }) {
  useEffect(() => {
    console.error(error);
    reportError(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#0d0c0f', color: '#fff', fontFamily: 'system-ui, sans-serif', textAlign: 'center' }}>
        <div style={{ padding: 24 }}>
          <div style={{ fontSize: 48, fontWeight: 700, color: '#ef4444' }}>Oops</div>
          <p>Something went wrong. <span dir="rtl" lang="ar">حدث خطأ ما.</span></p>
          <button onClick={() => reset()} style={{ marginTop: 12, padding: '10px 20px', borderRadius: 8, border: 0, background: '#ef4444', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
            Try again · حاول مجددًا
          </button>
        </div>
      </body>
    </html>
  );
}
