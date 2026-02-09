import React, { useState } from 'react';
import './App.css';
import AssignmentForm from './components/AssignmentForm';
import ResultsView from './components/ResultsView';
import { Assignment, MatchResponse } from './types';

const API_BASE = 'http://localhost:3000/api';

function App() {
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<MatchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleMatch = async (assignment: Assignment) => {
    setIsLoading(true);
    setError(null);
    try {
      // 1. Persist the assignment first
      const persistResponse = await fetch(`${API_BASE}/assignments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...assignment, userId: 'test-user' }),
      });

      let assignmentId: string | undefined;
      if (persistResponse.ok) {
        const persistData = await persistResponse.json();
        assignmentId = persistData.data?.id;
      } else {
        console.warn('Failed to persist assignment, proceeding with match only');
      }

      // 2. Fetch matches (include assignmentId if available)
      const response = await fetch(`${API_BASE}/matches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignment, assignmentId }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch creator matches. Please check if services are running.');
      }

      const jsonResponse = await response.json();
      if (jsonResponse.success) {
        setResults({
          ...jsonResponse.data,
          timestamp: jsonResponse.timestamp
        });
      } else {
        throw new Error(jsonResponse.error || 'Failed to fetch creator matches');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An error occurred during matching');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container">
      <header style={{ textAlign: 'center', marginBottom: '4rem', marginTop: '2rem' }}>
        <h1 style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>
          Drumbeat <span className="gradient-text">Matcher</span>
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '1.25rem' }}>
          Intelligently matching content assignments with mission-aligned creators
        </p>
      </header>

      <main style={{ minHeight: '60vh' }}>
        {error && (
          <div className="glass-card animate-fade-in" style={{ padding: '1rem 1.5rem', marginBottom: '2rem', borderLeft: '4px solid var(--error)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--error)' }}>{error}</span>
            <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)' }}>✕</button>
          </div>
        )}

        {isLoading ? (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <div className="glass-card skeleton" style={{ height: '300px' }}></div>
            <div className="glass-card skeleton" style={{ height: '200px' }}></div>
            <div className="glass-card skeleton" style={{ height: '200px' }}></div>
          </div>
        ) : results ? (
          <ResultsView data={results} onBack={() => setResults(null)} />
        ) : (
          <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            <div style={{ marginBottom: '2rem' }}>
              <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Create Assignment</h2>
              <p style={{ color: 'var(--text-muted)' }}>Define your content goals to find the perfect creator partners.</p>
            </div>
            <AssignmentForm onSubmit={handleMatch} isLoading={isLoading} />
          </div>
        )}
      </main>

      <footer style={{ marginTop: '6rem', paddingBottom: '3rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
        © {new Date().getFullYear()} Drumbeat Labs • Powered by AI Semantic Matching
      </footer>

      <style>{`
        .skeleton {
          background: linear-gradient(
            90deg,
            rgba(241, 245, 249, 0.8) 25%,
            rgba(226, 232, 240, 0.9) 50%,
            rgba(241, 245, 249, 0.8) 75%
          );
          background-size: 200% 100%;
          animation: skeleton-loading 1.5s infinite;
          border-radius: 1rem;
        }

        @keyframes skeleton-loading {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}

export default App;