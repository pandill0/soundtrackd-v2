import type { Session, SupabaseClient, User } from '@supabase/supabase-js';
import type { Profile } from '$lib/types';

declare global {
	namespace App {
		interface Locals {
			supabase: SupabaseClient;
			safeGetSession: () => Promise<{ session: Session | null; user: User | null }>;
			session: Session | null;
			user: User | null;
			profile: Profile | null;
			/** Set by the sign-in action before Supabase writes its cookies. */
			remember?: boolean;
		}
		interface PageData {
			session: Session | null;
			user: User | null;
			profile: Profile | null;
		}
		// interface Error {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
