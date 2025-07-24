import React, { useState, useEffect } from 'react';

const API_URL = 'http://localhost:3000';

export function TestDashboard() {
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [health, setHealth] = useState<any>(null);

  useEffect(() => {
    checkHealth();
  }, []);

  const checkHealth = async () => {
    try {
      const res = await fetch(`${API_URL}/health`);
      const data = await res.json();
      setHealth(data);
    } catch (err) {
      console.error('Health check failed:', err);
    }
  };

  const testFacebookPost = async () => {
    if (!message.trim()) {
      setError('Inserisci un messaggio!');
      return;
    }

    setLoading(true);
    setError(null);
    setResponse(null);

    try {
      const res = await fetch(`${API_URL}/api/test-facebook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message }),
      });

      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Errore nella pubblicazione');
      }

      setResponse(data);
      setMessage(''); // Clear message on success
    } catch (err: any) {
      setError(err.message);
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Status Card */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">🔌 Stato Connessione</h2>
        {health ? (
          <div className="space-y-2 text-sm">
            <div className="flex items-center">
              <span className="w-4 h-4 bg-green-500 rounded-full mr-2"></span>
              Server: Attivo
            </div>
            <div className="flex items-center">
              <span className={`w-4 h-4 ${health.facebook.appId === 'Configured' ? 'bg-green-500' : 'bg-red-500'} rounded-full mr-2`}></span>
              Facebook App ID: {health.facebook.appId}
            </div>
            <div className="flex items-center">
              <span className={`w-4 h-4 ${health.facebook.pageId === 'Configured' ? 'bg-green-500' : 'bg-red-500'} rounded-full mr-2`}></span>
              Facebook Page ID: {health.facebook.pageId}
            </div>
            <div className="flex items-center">
              <span className={`w-4 h-4 ${health.facebook.token === 'Configured' ? 'bg-green-500' : 'bg-red-500'} rounded-full mr-2`}></span>
              Facebook Token: {health.facebook.token}
            </div>
          </div>
        ) : (
          <p className="text-gray-500">Connessione in corso...</p>
        )}
      </div>

      {/* Test Facebook Post */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">📘 Test Pubblicazione Facebook</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Messaggio da pubblicare
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              rows={4}
              placeholder="Scrivi qui il tuo messaggio di test per Facebook..."
            />
          </div>

          <button
            onClick={testFacebookPost}
            disabled={loading || !message.trim()}
            className={`px-4 py-2 rounded-md font-medium ${
              loading || !message.trim()
                ? 'bg-gray-300 cursor-not-allowed'
                : 'bg-primary text-white hover:bg-green-700'
            }`}
          >
            {loading ? 'Pubblicazione in corso...' : 'Pubblica su Facebook'}
          </button>

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-md">
              <p className="text-red-600 text-sm">❌ Errore: {error}</p>
            </div>
          )}

          {response && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-md">
              <p className="text-green-600 text-sm font-medium">✅ {response.message}</p>
              {response.postId && (
                <p className="text-green-600 text-sm mt-1">Post ID: {response.postId}</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-blue-50 rounded-lg p-6">
        <h3 className="font-semibold text-blue-900 mb-2">📝 Istruzioni per il Test</h3>
        <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800">
          <li>Verifica che tutti gli indicatori siano verdi</li>
          <li>Scrivi un messaggio di test</li>
          <li>Clicca "Pubblica su Facebook"</li>
          <li>Controlla la tua pagina Facebook per vedere il post</li>
          <li>Se ci sono errori, controlla il token nel file .env</li>
        </ol>
      </div>
    </div>
  );
}