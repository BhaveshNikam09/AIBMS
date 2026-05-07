import { createBrowserRouter, Navigate } from 'react-router-dom'
import { Shell } from './components/Shell'
import LandingPage from './pages/Landing'
import { Login } from './pages/Login'
import { Signup } from './pages/Signup'
import { Dashboard } from './pages/Dashboard'
import { DigitalCashbook } from './pages/DigitalCashbook'
import { MultiBranch } from './pages/MultiBranch'
// import { ITRAnalysis } from './pages/ITRAnalysis'  // disconnected – file kept
import { DocumentIntelligence } from './pages/DocumentIntelligence'
import { AICAChatbot } from './pages/AICAChatbot'
import { Reports } from './pages/Reports'
import { Settings } from './pages/Settings'
import { LedgerBook } from './pages/LedgerBook'
import { canAccess, getPrimaryRoute, getStoredRole } from './utils/rbac'

function GuardDashboard()  { return canAccess('dashboard') ? <Dashboard />           : <Navigate to={getPrimaryRoute(getStoredRole())} replace /> }
function GuardCashbook()   { return canAccess('cashbook')  ? <DigitalCashbook />     : <Navigate to={getPrimaryRoute(getStoredRole())} replace /> }
function GuardLedger()     { return canAccess('ledger')    ? <LedgerBook />          : <Navigate to={getPrimaryRoute(getStoredRole())} replace /> }
function GuardBranches()   { return canAccess('branches')  ? <MultiBranch />         : <Navigate to={getPrimaryRoute(getStoredRole())} replace /> }
// ITR disconnected – route removed but file kept
function GuardDocuments()  { return canAccess('documents') ? <DocumentIntelligence /> : <Navigate to={getPrimaryRoute(getStoredRole())} replace /> }
function GuardChatbot()    { return canAccess('chatbot')   ? <AICAChatbot />         : <Navigate to={getPrimaryRoute(getStoredRole())} replace /> }
function GuardReports()    { return canAccess('reports')   ? <Reports />             : <Navigate to={getPrimaryRoute(getStoredRole())} replace /> }
function GuardSettings()   { return canAccess('settings')  ? <Settings />            : <Navigate to={getPrimaryRoute(getStoredRole())} replace /> }

export const router = createBrowserRouter([
  { path: '/',       element: <LandingPage /> },
  { path: '/login',  element: <Login /> },
  { path: '/signup', element: <Signup /> },
  {
    path: '/dashboard',
    element: <Shell />,
    children: [
      { index: true,       element: <GuardDashboard /> },
      { path: 'cashbook',  element: <GuardCashbook /> },
      { path: 'ledger',    element: <GuardLedger /> },
      { path: 'branches',  element: <GuardBranches /> },
      // ITR route disconnected – { path: 'itr', element: <GuardITR /> },
      { path: 'documents', element: <GuardDocuments /> },
      { path: 'chatbot',   element: <GuardChatbot /> },
      { path: 'reports',   element: <GuardReports /> },
      { path: 'settings',  element: <GuardSettings /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])
