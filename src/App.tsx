import { useState } from 'react'
import { Home } from './components/pages/Home'
import { Gantt } from './components/pages/Gantt'
import { CR } from './components/pages/CR'
import { Reports } from './components/pages/Reports'
import { Config } from './components/pages/Config'
import { Navigation } from './components/layout/Navigation'

type Page = 'home' | 'gantt' | 'cr' | 'config' | 'rapports'

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('home')

  return (
    <div className="app-wrapper">
      <div className="app-body">
        {currentPage === 'home'    && <Home />}
        {currentPage === 'gantt'   && <Gantt />}
        {currentPage === 'cr'      && <CR />}
        {currentPage === 'rapports'&& <Reports />}
        {currentPage === 'config'  && <Config />}
      </div>
      <Navigation currentPage={currentPage} onPageChange={setCurrentPage} />
    </div>
  )
}
