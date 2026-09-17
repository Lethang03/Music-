import { supabase } from '../../lib/supabase'
import { createStorageProvider } from './providerFactory'

export const storageProvider = createStorageProvider(supabase, import.meta.env.VITE_STORAGE_PROVIDER || 'supabase')
