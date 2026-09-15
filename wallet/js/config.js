/* Optional cloud backend.

   Leave these blank and the app runs entirely on-device: accounts, the
   passcode and the wallet all live in this browser's storage. Fill them in
   and the same screens sign in against Supabase instead, so one account
   works across devices. Nothing else in the app needs to change.

   The anon key is a publishable key — it is safe in client code, provided
   row-level security is on (see README). Never put a service-role key here. */

export const config = {
  supabase: {
    url: '',      // e.g. 'https://xxxxxxxxxxxx.supabase.co'
    anonKey: '',  // the project's anon / publishable key
  },
};
