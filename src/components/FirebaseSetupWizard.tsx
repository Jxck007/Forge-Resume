import React, { useState } from 'react';
import { initializeFirebase } from '../config/firebase';

interface Props {
  onComplete: () => void;
}

export default function FirebaseSetupWizard({ onComplete }: Props) {
  const [config, setConfig] = useState({
    apiKey: '',
    authDomain: '',
    projectId: '',
    storageBucket: '',
    messagingSenderId: '',
    appId: ''
  });
  const [error, setError] = useState('');
  const [showGuide, setShowGuide] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setConfig({ ...config, [e.target.name]: e.target.value.trim() });
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!config.apiKey || !config.projectId) {
      setError('At least API Key and Project ID are required.');
      return;
    }
    if (config.apiKey.includes('AIzaSy...')) {
      setError('Please provide your actual Firebase configuration, not the placeholder.');
      return;
    }
    
    try {
      initializeFirebase(config);
      localStorage.setItem('forge_custom_firebase_config', JSON.stringify(config));
      onComplete();
    } catch (err: any) {
      setError(err.message || 'Verification failed. Please check your config.');
    }
  };

  const handleJsonSubmit = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    try {
      const val = e.target.value.trim();
      if (!val) return;
      const parsed = JSON.parse(val);
      if (parsed.apiKey && String(parsed.apiKey).includes('AIzaSy...')) {
        setError('Please provide your actual Firebase configuration, not the placeholder.');
        return;
      }
      initializeFirebase(parsed);
      localStorage.setItem('forge_custom_firebase_config', JSON.stringify(parsed));
      onComplete();
    } catch {
      setError('Invalid JSON snippet.');
    }
  };

  if (showGuide) {
    return (
      <div className="min-h-screen bg-zinc-50 py-12 px-4 sm:px-6 lg:px-8 font-sans">
        <div className="max-w-3xl mx-auto bg-white p-8 rounded-xl shadow-sm border border-zinc-200">
          <button onClick={() => setShowGuide(false)} className="text-sm font-medium text-indigo-600 hover:text-indigo-500 mb-6 flex items-center">
            &larr; Back to Setup
          </button>
          <h2 className="text-3xl font-extrabold text-zinc-900 mb-6">Firebase Setup Guide</h2>
          <div className="space-y-6 text-zinc-700 text-sm">
            <section>
              <h3 className="font-bold text-lg text-zinc-900">1. Create a Firebase Project</h3>
               <ol className="list-decimal pl-5 space-y-1 mt-2">
                 <li>Go to <a href="https://console.firebase.google.com/" target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">Firebase Console</a></li>
                 <li>Click <strong>Add project</strong> and follow the steps.</li>
                 <li>Disable Google Analytics to streamline setup (optional).</li>
               </ol>
            </section>
            <section>
              <h3 className="font-bold text-lg text-zinc-900">2. Enable Authentication</h3>
               <ol className="list-decimal pl-5 space-y-1 mt-2">
                 <li>In the left sidebar, click <strong>Build &gt; Authentication</strong>.</li>
                 <li>Click <strong>Get Started</strong>.</li>
                 <li>Under the <strong>Sign-in method</strong> tab, enable <strong>Email/Password</strong> and <strong>Google Protocol</strong>.</li>
               </ol>
            </section>
            <section>
              <h3 className="font-bold text-lg text-zinc-900">3. Create Firestore Database</h3>
               <ol className="list-decimal pl-5 space-y-1 mt-2">
                 <li>In the left sidebar, click <strong>Build &gt; Firestore Database</strong>.</li>
                 <li>Click <strong>Create database</strong>.</li>
                 <li>Select a location and click <strong>Next</strong>.</li>
                 <li>Start in <strong>Test mode</strong> for now, then click <strong>Enable</strong>.</li>
                 <li>Update rules later to match the provided security rules format.</li>
               </ol>
            </section>
            <section>
              <h3 className="font-bold text-lg text-zinc-900">4. Get Project Configuration</h3>
               <ol className="list-decimal pl-5 space-y-1 mt-2">
                 <li>Click the <strong>Project Overview</strong> gear icon (top left) and select <strong>Project settings</strong>.</li>
                 <li>Under the <strong>General</strong> tab, scroll down to <strong>Your apps</strong>.</li>
                 <li>Click the <strong>&lt;/&gt; Web</strong> button to add a web app.</li>
                 <li>Enter an app nickname (e.g., "ResumeForge") and click <strong>Register app</strong>.</li>
                 <li>Copy the `firebaseConfig` JSON object (starting with <code>{"{ apiKey: ... }"}</code>).</li>
                 <li>Return to the setup screen and paste the JSON snippet.</li>
               </ol>
            </section>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-5 bg-white p-8 rounded-xl shadow-sm border border-zinc-200">
        <div>
          <h2 className="text-center text-3xl font-extrabold text-zinc-900">
            Firebase Connection Required
          </h2>
          <p className="mt-2 text-center text-sm text-zinc-600">
            A valid Firebase Project is required for real-time resume storage (Spark Plan supported).
          </p>
        </div>
        
        {error && (
          <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm mb-4">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1 flex justify-between">
              Paste JSON Configuration
              <button type="button" onClick={() => setShowGuide(true)} className="text-indigo-600 hover:text-indigo-500 font-semibold text-xs">
                How do I get this?
              </button>
            </label>
            <textarea
              className="block w-full px-3 py-2 border border-zinc-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm font-mono text-xs"
              placeholder={'{\n  "apiKey": "AIzaSy...",\n  "authDomain": "...",\n  "projectId": "...",\n  ... \n}'}
              onChange={handleJsonSubmit}
              rows={6}
            />
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-zinc-300" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-zinc-500 font-medium text-xs">Or enter fields manually</span>
            </div>
          </div>

          <form onSubmit={handleManualSubmit} className="space-y-3">
            {Object.keys(config).map((key) => (
              <div key={key}>
                <input
                  type="text"
                  name={key}
                  placeholder={key.replace(/([A-Z])/g, ' $1').trim().replace(/^./, str => str.toUpperCase())}
                  value={config[key as keyof typeof config]}
                  onChange={handleChange}
                  className="appearance-none block w-full px-3 py-1.5 border border-zinc-300 rounded-md shadow-sm placeholder-zinc-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
              </div>
            ))}
            
            <button
              type="submit"
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Initialize Workspace
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
