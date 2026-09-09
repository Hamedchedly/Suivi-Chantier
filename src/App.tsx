import { useState } from 'react'
import { Home } from './components/pages/Home'
import { Gantt } from './components/pages/Gantt'
import { Reports } from './components/pages/Reports'
import { Config } from './components/pages/Config'
import { Navigation } from './components/layout/Navigation'

type Page = 'home' | 'gantt' | 'reports' | 'config'

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('home')

  return (
    <div className="min-h-screen bg-[#f3f6f9] flex flex-col">
      {/* Main Content */}
      <div className="flex-1 max-w-6xl mx-auto w-full">
        {currentPage === 'home' && <Home />}
        {currentPage === 'gantt' && <Gantt />}
        {currentPage === 'reports' && <Reports />}
        {currentPage === 'config' && <Config />}
      </div>

      {/* Navigation Bar */}
      <Navigation currentPage={currentPage} onPageChange={setCurrentPage} />
    </div>
  )
}
