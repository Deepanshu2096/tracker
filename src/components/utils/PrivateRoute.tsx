import { useEffect, useState } from 'react'
import { useNavigate, Outlet, useParams } from 'react-router'
import { useAuth } from '../../hooks/useAuth'
import { useProjectStore } from '../../store/projectStore'
import { ROUTES_FRONTEND } from '../../constant'

export function PrivateRoute() {
    const { user, loading } = useAuth()
    const { getUserProjectIds } = useProjectStore()
    const navigate = useNavigate()
    const { projectId } = useParams<{ projectId: string }>()
    const [checkingProjectAccess, setCheckingProjectAccess] = useState(false)
    
    useEffect(() => {
        // If not authenticated and not loading, redirect to login
        if (!loading && !user) {
            navigate(ROUTES_FRONTEND.LOGIN)
        }
    }, [user, loading, navigate])

    useEffect(() => {
        // Check project access if projectId exists in URL
        const checkProjectAccess = async () => {
            if (!user?.id || !projectId) {
                return
            }

            try {
                setCheckingProjectAccess(true)
                const userProjectIds = await getUserProjectIds(user.id)
                
                // If user doesn't have access to this project, redirect to projects page
                if (!userProjectIds.includes(projectId)) {
                    navigate(ROUTES_FRONTEND.PROJECTS)
                }
            } catch (error) {
                console.error('Error checking project access:', error)
                navigate(ROUTES_FRONTEND.PROJECTS)
            } finally {
                setCheckingProjectAccess(false)
            }
        }

        checkProjectAccess()
    }, [user?.id, projectId, getUserProjectIds, navigate])
    
    // Show loading state while checking authentication or project access
    if (loading || checkingProjectAccess) {
        return <div>Loading...</div>
    }
    
    // If not authenticated, don't render anything (will redirect)
    if (!user) {
        return null
    }
    
    // If authenticated, allow access to private routes
    return <Outlet />
}