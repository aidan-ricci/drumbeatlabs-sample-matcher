import React from 'react';
import { MatchResponse } from '../types';
import CreatorCard from './CreatorCard';

interface Props {
    data: MatchResponse;
    onBack: () => void;
}

const ResultsView: React.FC<Props> = ({ data, onBack }) => {
    return (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button
                    onClick={onBack}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                >
                    ← Back to Assignment
                </button>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                    Matched at {new Date(data.timestamp).toLocaleTimeString()}
                </div>
            </div>

            {data.isFallback && (
                <div className="glass-card animate-fade-in" style={{ padding: '1rem 1.5rem', marginBottom: '1rem', borderLeft: '4px solid var(--warning)', background: 'rgba(245, 158, 11, 0.1)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span style={{ fontSize: '1.25rem' }}>⚠️</span>
                        <div>
                            <strong style={{ color: 'var(--warning)', display: 'block' }}>Search Limited (Fallback Mode)</strong>
                            <span style={{ fontSize: '0.875rem', color: 'var(--text-main)' }}>Our advanced semantic search is currently unavailable. Results are based on direct attribute alignment (niches, values, etc.).</span>
                        </div>
                    </div>
                </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <h2 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Top 3 Creator Recommendations</h2>
                {data.matches?.map((match, index) => (
                    <CreatorCard key={match.creator.uniqueId} match={match} rank={index + 1} />
                ))}
            </div>

            {data.matches.length === 0 && (
                <div className="glass-card" style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No creators matched your criteria. Try loosening your niche or value requirements.
                </div>
            )}
        </div>
    );
};

export default ResultsView;
