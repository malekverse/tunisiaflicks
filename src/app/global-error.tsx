"use client";

import { useEffect } from 'react';
import { reportError } from '@/src/lib/report-error';

// Last-resort boundary for errors in the root layout itself (error.tsx can't catch those). It
// replaces the whole document, so it has its own <html> and can't use the i18n provider, the fonts
// or the stylesheet: everything is inline, and the message is shown in English and Arabic. Same
// look as the rest of the site: a black room, one big word in the light, a red button.
const font = 'system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans Arabic", Tahoma, sans-serif';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }, reset: () => void }) {
  useEffect(() => {
    console.error(error);
    reportError(error);
  }, [error]);

  return (
    <html lang="en">
      <head>
        <title>TunisiaFlicks</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#000000" />
      </head>
      <body
        style={{
          margin: 0,
          minHeight: '100dvh',
          display: 'grid',
          placeItems: 'center',
          background: 'radial-gradient(60% 55% at 50% 0%, rgba(255,255,255,0.09), rgba(255,255,255,0.02) 55%, transparent 80%), #000',
          color: '#fff',
          fontFamily: font,
          textAlign: 'center',
          WebkitFontSmoothing: 'antialiased',
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        <main style={{ padding: '48px 24px', maxWidth: 560 }}>
          <div
            aria-hidden
            style={{
              fontSize: 'clamp(96px, 22vw, 200px)',
              fontWeight: 800,
              lineHeight: 0.85,
              letterSpacing: '-0.04em',
              backgroundImage: 'linear-gradient(to bottom, #fff, rgba(255,255,255,0.7) 45%, rgba(255,255,255,0))',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              color: 'transparent',
              userSelect: 'none',
            }}
          >
            Oops
          </div>
          <h1 style={{ margin: '24px 0 0', fontSize: 'clamp(24px, 4vw, 32px)', fontWeight: 800, lineHeight: 1.1, letterSpacing: '-0.01em' }}>
            Something went wrong.
          </h1>
          <p dir="rtl" lang="ar" style={{ margin: '10px 0 0', fontSize: 18, lineHeight: 1.7, color: 'rgba(255,255,255,0.75)' }}>
            حدث خطأ ما.
          </p>
          <div style={{ marginTop: 32, display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
            <button
              type="button"
              onClick={() => reset()}
              style={{
                height: 48,
                padding: '0 28px',
                borderRadius: 999,
                border: 0,
                background: '#E50F05',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.22), 0 10px 30px -10px rgba(229,15,5,0.7)',
                color: '#fff',
                fontFamily: font,
                fontSize: 15,
                fontWeight: 600,
                cursor: 'pointer',
                touchAction: 'manipulation',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <span>Try again</span>
              <span lang="ar" style={{ opacity: 0.8 }}>حاول مجددًا</span>
            </button>
            {/* A plain link: a full page load, in case the client app itself is what broke. */}
            <a
              href="/"
              style={{
                height: 48,
                padding: '0 24px',
                borderRadius: 999,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 10,
                background: 'rgba(255,255,255,0.1)',
                color: '#fff',
                fontSize: 15,
                fontWeight: 500,
                textDecoration: 'none',
                touchAction: 'manipulation',
              }}
            >
              <span>Home</span>
              <span lang="ar" style={{ opacity: 0.75 }}>الرئيسية</span>
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
