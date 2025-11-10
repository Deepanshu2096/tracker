import { RouterProvider } from 'react-router-dom'
import { router } from './routes'
import { AuthProvider } from './hooks/useAuth'
import { Toaster } from './components/ui/toaster'

function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
      <Toaster />
    </AuthProvider>
  )
}

export default App
