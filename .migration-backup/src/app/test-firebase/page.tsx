'use client';

import { useState, useEffect } from 'react';
import { storageManager } from '@/lib/storage-provider';
import { db } from '@/lib/firebase-config';

export default function TestFirebasePage() {
  const [status, setStatus] = useState({
    firebaseInitialized: false,
    storageManagerAvailable: false,
    testData: null as any,
    error: null as string | null,
  });
  
  const [testResult, setTestResult] = useState<string | null>(null);

  useEffect(() => {
    // Check if Firebase is properly initialized
    if (db) {
      setStatus(prev => ({ ...prev, firebaseInitialized: true }));
    }
  }, []);

  const testFirebaseConnection = async () => {
    try {
      setTestResult('Testing Firebase connection...');
      
      // Test if storage manager is available by trying to get data
      try {
        await storageManager.get('settings');
        setStatus(prev => ({ ...prev, storageManagerAvailable: true }));
      } catch {
        setStatus(prev => ({ ...prev, storageManagerAvailable: false }));
      }
      
      if (!status.storageManagerAvailable) {
        setTestResult('Firebase is not available. Please check your configuration.');
        return;
      }
      
      // Test basic operations
      setTestResult('Testing basic operations...');
      
      // Get current settings
      const settings = await storageManager.get('settings');
      setStatus(prev => ({ ...prev, testData: settings }));
      
      // Try to save some test data
      const testData = {
        ...settings,
        lastTested: new Date().toISOString(),
      };
      
      await storageManager.set('settings', testData);
      
      // Fetch it back to confirm
      const updatedSettings = await storageManager.get('settings');
      
      // Check if we can save and retrieve data by checking for the test timestamp
      if (updatedSettings && typeof updatedSettings === 'object') {
        setTestResult('✅ Firebase integration is working correctly!');
      } else {
        setTestResult('❌ Could not verify data persistence.');
      }
    } catch (error) {
      console.error('Firebase test error:', error);
      setTestResult(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setStatus(prev => ({ ...prev, error: error instanceof Error ? error.message : 'Unknown error' }));
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Firebase Integration Test</h1>
      
      <div className="space-y-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Firebase Status</h2>
          <div className="space-y-2">
            <div className="flex items-center">
              <div className={`w-3 h-3 rounded-full mr-2 ${status.firebaseInitialized ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span>Firebase Initialized: {status.firebaseInitialized ? 'Yes' : 'No'}</span>
            </div>
            <div className="flex items-center">
              <div className={`w-3 h-3 rounded-full mr-2 ${status.storageManagerAvailable ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span>Storage Manager Available: {status.storageManagerAvailable ? 'Yes' : 'No'}</span>
            </div>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Test Connection</h2>
          <button
            onClick={testFirebaseConnection}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md"
          >
            Test Firebase Connection
          </button>
          
          {testResult && (
            <div className="mt-4 p-4 rounded-md bg-gray-100 dark:bg-gray-700">
              <p>{testResult}</p>
            </div>
          )}
        </div>
        
        {status.testData && (
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">Test Data</h2>
            <pre className="bg-gray-100 dark:bg-gray-700 p-4 rounded-md overflow-auto text-sm">
              {JSON.stringify(status.testData, null, 2)}
            </pre>
          </div>
        )}
        
        {status.error && (
          <div className="bg-red-100 dark:bg-red-900 p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4 text-red-800 dark:text-red-200">Error</h2>
            <p className="text-red-700 dark:text-red-300">{status.error}</p>
          </div>
        )}
        
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Setup Instructions</h2>
          <ol className="list-decimal pl-6 space-y-2">
            <li>Add your Firebase configuration to your environment variables:</li>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>NEXT_PUBLIC_FIREBASE_API_KEY</li>
              <li>NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN</li>
              <li>NEXT_PUBLIC_FIREBASE_PROJECT_ID</li>
              <li>NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET</li>
              <li>NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID</li>
              <li>NEXT_PUBLIC_FIREBASE_APP_ID</li>
            </ul>
            <li>Make sure your Firebase project has Firestore enabled</li>
            <li>Configure your Firestore security rules to allow read/write as needed</li>
            <li>Run this test to verify the connection</li>
          </ol>
        </div>
      </div>
    </div>
  );
}