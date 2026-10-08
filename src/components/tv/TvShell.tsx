// STUB: implemented by tv-mode in wave 2; keep the signature
// The remote-friendly shell. In TV mode (cookie tf-tv=1) the root layout renders it instead of the
// Rail, TopBar, TabBar, Footer, PeekLayer, SearchPaletteHost and ShareSheetHost. For now it only
// renders the page.
"use client"
import type React from 'react'

export default function TvShell({ children }: { children: React.ReactNode }): JSX.Element {
  return <>{children}</>
}
