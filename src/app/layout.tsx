import type { Metadata } from 'next'
import './globals.css'
import { AuthProvider } from '@/hooks/useAuth'
import { StoreProvider } from '@/hooks/useStore'

export const metadata: Metadata = {
  title: 'StockGuard — Inventory Management',
  description: 'Multi-store hotel inventory management with theft detection',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <StoreProvider>
            {children}
          </StoreProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
