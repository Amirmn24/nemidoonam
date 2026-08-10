import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import AppLayout from './app/layout/AppLayout'
import { GuestRoute, ProtectedRoute } from './app/routes/guards'
import AuthPage from './features/accounts/AuthPage'
import ProfilePage from './features/accounts/ProfilePage'
import BookDetailPage from './features/books/BookDetailPage'
import BookFormPage from './features/books/BookFormPage'
import BookListPage from './features/books/BookListPage'
import EntryFormPage from './features/books/EntryFormPage'
import ChallengeDetailPage from './features/challenges/ChallengeDetailPage'
import ChallengeFormPage from './features/challenges/ChallengeFormPage'
import ChallengeListPage from './features/challenges/ChallengeListPage'
import DashboardPage from './features/dashboard/DashboardPage'
import LandingPage from './features/landing/LandingPage'
import WordFormPage from './features/vocabulary/WordFormPage'
import WordListPage from './features/vocabulary/WordListPage'
import { AuthProvider } from './shared/AuthContext'
import { ThemeProvider } from './shared/ThemeContext'

const PdfReaderPage = lazy(() =>
  import('./features/pdf').then((m) => ({ default: m.PdfReaderPage })),
)

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<LandingPage />} />

            <Route element={<GuestRoute />}>
              <Route path="/login" element={<AuthPage mode="login" />} />
              <Route path="/signup" element={<AuthPage mode="signup" />} />
            </Route>

            <Route element={<ProtectedRoute />}>
              <Route
                path="/books/:id/read"
                element={
                  <Suspense
                    fallback={
                      <div className="pdf-reader-page">
                        <p className="pdf-viewer-status">…</p>
                      </div>
                    }
                  >
                    <PdfReaderPage />
                  </Suspense>
                }
              />

              <Route element={<AppLayout />}>
                <Route path="/app" element={<DashboardPage />} />
                <Route path="/books" element={<BookListPage />} />
                <Route path="/books/new" element={<BookFormPage />} />
                <Route path="/books/:id" element={<BookDetailPage />} />
                <Route path="/books/:id/edit" element={<BookFormPage />} />
                <Route path="/books/:id/entries/new" element={<EntryFormPage />} />
                <Route path="/books/:id/entries/:entryId/edit" element={<EntryFormPage />} />
                <Route path="/challenges" element={<ChallengeListPage />} />
                <Route path="/challenges/new" element={<ChallengeFormPage />} />
                <Route path="/challenges/:id" element={<ChallengeDetailPage />} />
                <Route path="/challenges/:id/edit" element={<ChallengeFormPage />} />
                <Route path="/vocabulary" element={<WordListPage />} />
                <Route path="/vocabulary/new" element={<WordFormPage />} />
                <Route path="/vocabulary/:id/edit" element={<WordFormPage />} />
                <Route path="/profile" element={<ProfilePage />} />
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  )
}
