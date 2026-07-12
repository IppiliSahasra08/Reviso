'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

export type AuthMode = 'sign-in' | 'sign-up'

export interface AuthUIProps {
  /** Initial mode. Defaults to 'sign-in'. The component manages its own mode
   * switching internally, but you can control the starting point (e.g. a
   * dedicated /signup route). */
  initialMode?: AuthMode
  /** Where to send the user after a successful sign-in. Defaults to /. */
  redirectTo?: string
  /** Href for the "Forgot password?" link. Defaults to /forgot-password. */
  forgotPasswordHref?: string
}

export function AuthUI({
  initialMode = 'sign-in',
  redirectTo = '/',
  forgotPasswordHref = '/forgot-password',
}: AuthUIProps) {
  const router = useRouter()
  const supabase = createClient()

  const [mode, setMode] = useState<AuthMode>(initialMode)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const [error, setError] = useState<string | null>(null)
  const [infoMessage, setInfoMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  function switchMode(next: AuthMode) {
    setMode(next)
    setError(null)
    setInfoMessage(null)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setInfoMessage(null)
    setLoading(true)

    try {
      if (mode === 'sign-in') {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (signInError) {
          setError(signInError.message)
          return
        }

        router.push(redirectTo)
        router.refresh()
      } else {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        })

        if (signUpError) {
          setError(signUpError.message)
          return
        }

        setInfoMessage('Check your inbox to confirm your email before signing in.')
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleGoogleSignIn() {
    setError(null)
    setInfoMessage(null)
    setGoogleLoading(true)

    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (oauthError) {
      setError(oauthError.message)
      setGoogleLoading(false)
    }
    // On success, Supabase redirects the browser away, so no need to reset loading.
  }

  return (
    <div className="flex flex-col gap-5">
      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      {infoMessage && (
        <div
          role="status"
          className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700"
        >
          {infoMessage}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="auth-email" className="text-sm font-medium text-slate-700">
            Email
          </label>
          <input
            id="auth-email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="auth-password" className="text-sm font-medium text-slate-700">
              Password
            </label>
            {mode === 'sign-in' && (
              <Link
                href={forgotPasswordHref}
                className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
              >
                Forgot password?
              </Link>
            )}
          </div>
          <div className="relative">
            <input
              id="auth-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required
              className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 pr-10 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              aria-pressed={showPassword}
              className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600"
            >
              {showPassword ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="h-4 w-4"
                  aria-hidden="true"
                >
                  <path d="M3.28 2.22a.75.75 0 00-1.06 1.06l14.5 14.5a.75.75 0 101.06-1.06l-1.745-1.745a10.29 10.29 0 003.081-4.001 1.2 1.2 0 000-.964C17.766 6.257 14.522 4 10.75 4a9.98 9.98 0 00-4.09.886l-3.38-3.38A.75.75 0 003.28 2.22zM7.06 7.5l1.5 1.5a2.25 2.25 0 002.94 2.94l1.5 1.5a3.75 3.75 0 01-5.94-4.94z" />
                  <path d="M15.5 12.318l-1.14-1.14a2.25 2.25 0 00-2.538-2.538L10.68 7.5a3.75 3.75 0 013.83 3.83c0 .35-.06.685-.17 1z" />
                </svg>
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="h-4 w-4"
                  aria-hidden="true"
                >
                  <path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
                  <path
                    fillRule="evenodd"
                    d="M.664 10.59a1.651 1.651 0 010-1.186A10.004 10.004 0 0110 3c4.257 0 7.893 2.66 9.336 6.41.147.381.147.804 0 1.186A10.004 10.004 0 0110 17c-4.257 0-7.893-2.66-9.336-6.41zM14 10a4 4 0 11-8 0 4 4 0 018 0z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </button>
          </div>
        </div>

        <Button type="submit" variant="primary" loading={loading} className="w-full">
          {mode === 'sign-in' ? 'Sign in' : 'Create account'}
        </Button>
      </form>

      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-slate-200" />
        <span className="text-xs uppercase tracking-wide text-slate-400">or</span>
        <div className="h-px flex-1 bg-slate-200" />
      </div>

      <Button
        type="button"
        variant="outline"
        className="w-full"
        loading={googleLoading}
        onClick={handleGoogleSignIn}
      >
        {!googleLoading && (
          <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
            <path
              fill="#4285F4"
              d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.47a5.54 5.54 0 01-2.4 3.64v3h3.88c2.27-2.09 3.57-5.17 3.57-8.83z"
            />
            <path
              fill="#34A853"
              d="M12 24c3.24 0 5.96-1.07 7.95-2.9l-3.88-3c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.27v3.11A12 12 0 0012 24z"
            />
            <path
              fill="#FBBC05"
              d="M5.27 14.29A7.2 7.2 0 014.89 12c0-.79.14-1.56.38-2.29V6.6H1.27A12 12 0 000 12c0 1.94.46 3.77 1.27 5.4l4-3.11z"
            />
            <path
              fill="#EA4335"
              d="M12 4.75c1.76 0 3.35.6 4.6 1.79l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 001.27 6.6l4 3.11C6.22 6.86 8.87 4.75 12 4.75z"
            />
          </svg>
        )}
        Continue with Google
      </Button>

      <p className="text-center text-sm text-slate-500">
        {mode === 'sign-in' ? (
          <>
            Don&apos;t have an account?{' '}
            <button
              type="button"
              onClick={() => switchMode('sign-up')}
              className="font-medium text-indigo-600 hover:text-indigo-700"
            >
              Sign up
            </button>
          </>
        ) : (
          <>
            Already have an account?{' '}
            <button
              type="button"
              onClick={() => switchMode('sign-in')}
              className="font-medium text-indigo-600 hover:text-indigo-700"
            >
              Sign in
            </button>
          </>
        )}
      </p>
    </div>
  )
}