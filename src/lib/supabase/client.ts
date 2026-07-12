import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/database'

export function createClient() {
  const client = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const dummyUser = {
    id: 'dummy-user-id',
    email: 'test@example.com',
    user_metadata: { full_name: 'Test User' },
    app_metadata: {},
    aud: 'authenticated',
    created_at: new Date().toISOString(),
  } as any

  client.auth.getUser = async () => {
    return { data: { user: dummyUser }, error: null }
  }

  client.auth.getSession = async () => {
    return {
      data: {
        session: {
          user: dummyUser,
          access_token: 'dummy-token',
          refresh_token: 'dummy-token',
          expires_in: 3600,
          token_type: 'bearer',
        } as any,
      },
      error: null,
    }
  }

  client.auth.onAuthStateChange = (callback: any) => {
    // Invoke callback instantly with mocked signed-in trigger
    setTimeout(() => {
      callback('SIGNED_IN', {
        user: dummyUser,
        access_token: 'dummy-token',
        refresh_token: 'dummy-token',
      })
    }, 0)
    return {
      data: {
        subscription: {
          id: 'dummy-subscription-id',
          callback: () => { },
          unsubscribe: () => { },
        } as any,
      },
    }
  }

  return client
}