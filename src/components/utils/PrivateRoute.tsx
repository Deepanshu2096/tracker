import { useEffect } from 'react'
import { useNavigate, Outlet } from 'react-router'
import { useAuth } from '../../hooks/useAuth'
import { ROUTES_FRONTEND } from '../../constant'

export function PrivateRoute() {
    const { user, loading } = useAuth()
    const navigate = useNavigate()
    
    useEffect(() => {
        // If not authenticated and not loading, redirect to login
        if (!loading && !user) {
            navigate(ROUTES_FRONTEND.LOGIN)
        }
    }, [user, loading, navigate])
    
    // Show loading state while checking authentication
    if (loading) {
        return <div>Loading...</div>
    }
    
    // If not authenticated, don't render anything (will redirect)
    if (!user) {
        return null
    }
    
    // If authenticated, allow access to private routes
    return <Outlet />
}