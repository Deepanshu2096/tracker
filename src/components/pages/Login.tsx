import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { ROUTES_FRONTEND } from '../../constant'
import LoginForm from '../LoginForm'

export default function Login() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    // If user is already authenticated and not loading, redirect to dashboard
    if (!loading && user) {
      navigate(ROUTES_FRONTEND.DASHBOARD)
    }
  }, [user, loading, navigate])

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    )
  }

  // If user is authenticated, don't render login form (will redirect)
  if (user) {
    return null
  }

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950">
      {/* Left side - brand / mission */}
      <div className="hidden lg:flex items-center justify-center bg-gradient-to-br from-blue-900 to-purple-900 text-white px-10">
        <div className="space-y-6 max-w-md">
          <div className="flex items-center space-x-3">
            <h1 className="text-2xl font-semibold tracking-wide p-2 px-4 border rounded-xl">Anvesana</h1>
          </div>
          <h2 className="text-4xl font-bold leading-tight">
          Anvesana 
          </h2>
          <p className="text-lg text-slate-200">

          </p>
        </div>
      </div>

      {/* Right side - login */}
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <LoginForm />
        </div>
      </div>
    </div>
  )
}
