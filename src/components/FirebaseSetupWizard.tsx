export default function FirebaseSetupWizard() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0B0F14] px-4 py-12">
      <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-[#171A21] p-8 shadow-2xl">
        <span className="text-xs font-bold uppercase tracking-widest text-emerald-300">Configuration required</span>
        <h2 className="mt-3 text-2xl font-bold text-white">Firebase environment variables are missing</h2>
        <p className="mt-3 text-sm leading-relaxed text-zinc-400">
          Copy <code className="text-zinc-200">.env.example</code> to <code className="text-zinc-200">.env.local</code>,
          add the Firebase web app values, then restart the development server.
        </p>
        <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-950/60 p-4 font-mono text-xs leading-6 text-zinc-300">
          VITE_FIREBASE_API_KEY<br />
          VITE_FIREBASE_AUTH_DOMAIN<br />
          VITE_FIREBASE_PROJECT_ID<br />
          VITE_FIREBASE_STORAGE_BUCKET<br />
          VITE_FIREBASE_MESSAGING_SENDER_ID<br />
          VITE_FIREBASE_APP_ID
        </div>
      </div>
    </div>
  );
}
