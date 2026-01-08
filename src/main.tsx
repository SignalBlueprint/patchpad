import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, useParams } from 'react-router-dom'
import App from './App'
import { SharedNote } from './pages/SharedNote'
import { AuthProvider } from './context/AuthContext'
import { initializeSyncEngine } from './services/syncEngine'
import './index.css'

// Initialize sync engine (starts background sync if configured)
initializeSyncEngine()

// Wrapper component to extract route params
function SharedNoteRoute() {
  const { token } = useParams<{ token: string }>();
  if (!token) {
    return <div>Invalid share link</div>;
  }
  return <SharedNote token={token} />;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/shared/:token" element={<SharedNoteRoute />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
