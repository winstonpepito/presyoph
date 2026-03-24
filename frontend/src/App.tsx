import type { ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { RootLayout } from './layouts/RootLayout'
import { AdminPage } from './pages/AdminPage'
import { CategoryPage } from './pages/CategoryPage'
import { EstablishmentPage } from './pages/EstablishmentPage'
import { HomePage } from './pages/HomePage'
import { PostPage } from './pages/PostPage'
import { ProductPage } from './pages/ProductPage'
import { ProfilePage } from './pages/ProfilePage'
import { SearchPage } from './pages/SearchPage'
import { RegisterPage } from './pages/RegisterPage'
import { SignInPage } from './pages/SignInPage'

function AdminRoute({ children }: { children: ReactNode }) {
  const { user, status } = useAuth()
  if (status === 'loading') {
    return <div className="mx-auto max-w-3xl px-4 py-16 text-center text-slate-500">Loading…</div>
  }
  if (user?.role !== 'ADMIN') {
    return <Navigate to="/auth/signin?callbackUrl=/admin" replace />
  }
  return <>{children}</>
}

function AppRoutes() {
  return (
    <Routes>
      <Route element={<RootLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/post" element={<PostPage />} />
        <Route path="/auth/signin" element={<SignInPage />} />
        <Route path="/auth/register" element={<RegisterPage />} />
        <Route path="/profile/:id" element={<ProfilePage />} />
        <Route path="/products/:slug" element={<ProductPage />} />
        <Route path="/categories/:slug" element={<CategoryPage />} />
        <Route path="/establishments/:slug" element={<EstablishmentPage />} />
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <AdminPage />
            </AdminRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
