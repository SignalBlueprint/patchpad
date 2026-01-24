import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, useParams } from 'react-router-dom'
import App from './App'
import { SharedNote } from './pages/SharedNote'
import { PublishedGraph } from './pages/PublishedGraph'
import { AuthProvider } from './context/AuthContext'
import { initializeSyncEngine } from './services/syncEngine'
import './index.css'

// Error Boundary component to catch and display errors
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('PatchPad Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '40px',
          fontFamily: 'system-ui, sans-serif',
          maxWidth: '600px',
          margin: '0 auto'
        }}>
          <h1 style={{ color: '#dc2626' }}>Something went wrong</h1>
          <p style={{ color: '#666' }}>PatchPad encountered an error:</p>
          <pre style={{
            background: '#f3f4f6',
            padding: '16px',
            borderRadius: '8px',
            overflow: 'auto',
            fontSize: '14px'
          }}>
            {this.state.error?.message}
            {'\n\n'}
            {this.state.error?.stack}
          </pre>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: '16px',
              padding: '8px 16px',
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Initialize sync engine (starts background sync if configured)
try {
  initializeSyncEngine()
} catch (e) {
  console.error('Failed to initialize sync engine:', e);
}

// Wrapper component to extract route params
function SharedNoteRoute() {
  const { token } = useParams<{ token: string }>();
  if (!token) {
    return <div>Invalid share link</div>;
  }
  return <SharedNote token={token} />;
}

// Wrapper component for published graph route
function PublishedGraphRoute() {
  const { userIdPrefix, slug } = useParams<{ userIdPrefix: string; slug: string }>();
  if (!userIdPrefix || !slug) {
    return <div>Invalid graph link</div>;
  }
  return <PublishedGraph userIdPrefix={userIdPrefix} slug={slug} />;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<App />} />
            <Route path="/shared/:token" element={<SharedNoteRoute />} />
            <Route path="/graphs/:userIdPrefix/:slug" element={<PublishedGraphRoute />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>,
)
