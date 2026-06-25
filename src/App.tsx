import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import ScreenAnalytics from './pages/ScreenAnalytics'
import DataManagement from './pages/DataManagement'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 2, refetchOnWindowFocus: false },
  },
})

type Page = 'analytics' | 'data'

export default function App() {
  const [page, setPage] = useState<Page>('analytics')

  useEffect(() => {
    document.documentElement.classList.add('dark')
    document.documentElement.classList.remove('light')
  }, [])

  return (
    <QueryClientProvider client={queryClient}>
      {page === 'analytics'
        ? <ScreenAnalytics onGoToData={() => setPage('data')} />
        : <DataManagement onBack={() => setPage('analytics')} />
      }
    </QueryClientProvider>
  )
}
