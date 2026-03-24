import { Outlet } from 'react-router-dom'
import { Nav } from '../components/Nav'

export function RootLayout() {
  return (
    <>
      <Nav />
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-500">
        PriceMonitorPH — prices are user-submitted and may be inaccurate.
      </footer>
    </>
  )
}
