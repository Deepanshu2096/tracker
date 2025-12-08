import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  const errorMessage = 'Supabase client missing configuration. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.';
  console.error('❌', errorMessage);
  console.error('Current values:', {
    hasUrl: !!SUPABASE_URL,
    hasKey: !!SUPABASE_ANON_KEY,
    urlPreview: SUPABASE_URL ? `${SUPABASE_URL.substring(0, 30)}...` : 'missing'
  });
  throw new Error(errorMessage);
}

// Configure Supabase client with better error handling
export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    // Add timeout for network requests
    flowType: 'pkce',
  },
  global: {
    headers: {
      'x-client-info': 'tauri-app',
    },
    // Add fetch options for better error handling
    fetch: (url, options = {}) => {
      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      return fetch(url, {
        ...options,
        signal: controller.signal,
      })
        .then((response) => {
          clearTimeout(timeoutId);
          return response;
        })
        .catch((error) => {
          clearTimeout(timeoutId);
          // Don't log connection errors - they'll be handled by the calling code
          if (error.name === 'AbortError') {
            throw new Error('Request timeout: Unable to connect to Supabase. Please check your internet connection.');
          }
          if (error.message?.includes('Failed to fetch') || error.message?.includes('hostname') || error.message?.includes('could not be found')) {
            throw new Error(`Cannot connect to Supabase: ${SUPABASE_URL}. Please verify the URL is correct and the project is active.`);
          }
          throw error;
        });
    },
  },
});

// Log configuration (without sensitive data)
console.log('✅ Supabase client initialized:', {
  url: SUPABASE_URL ? `${SUPABASE_URL.substring(0, 30)}...` : 'missing',
  hasKey: !!SUPABASE_ANON_KEY,
});

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";