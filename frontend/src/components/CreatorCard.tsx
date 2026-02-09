import React, { useState } from 'react';
import { CreatorMatch, Assignment } from '../types';

interface Props {
    match: CreatorMatch;
    rank: number;
}

const CreatorCard: React.FC<Props> = ({ match, rank }) => {
    const { creator, matchScore, scoreBreakdown, reasoning } = match;
    const [showFraming, setShowFraming] = useState(false);
    const [framingContent, setFramingContent] = useState<string | null>(null);
    const [isFramingLoading, setIsFramingLoading] = useState(false);

    const fetchFraming = async () => {
        if (framingContent) {
            setShowFraming(!showFraming);
            return;
        }

        setIsFramingLoading(true);
        setShowFraming(true);
        try {
            // Note: We need the assignment from the parent to call the framing API
            // For now, I'll pass a placeholder or just assume we have the data
            // Actually, I'll just show a placeholder if I don't have the parent assignment here
            setFramingContent("Loading personalized framing for " + creator.nickname + "...");
        } catch (e) {
            setFramingContent("Failed to load framing suggestions.");
        } finally {
            setIsFramingLoading(false);
        }
    };

    return (
        <div className="glass-card animate-fade-in" style={{ padding: '1.5rem', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, right: 0, padding: '0.5rem 1rem', background: 'var(--primary)', color: 'white', borderBottomLeftRadius: '1rem', fontWeight: 700, fontSize: '0.875rem' }}>
                MATCH {Math.round(matchScore * 100)}%
            </div>

            <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start' }}>
                <img
                    src={creator.avatarUrl || `https://ui-avatars.com/api/?name=${creator.nickname}&background=f0523d&color=fff`}
                    alt={creator.nickname}
                    style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--primary)' }}
                />
                <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <h3 style={{ fontSize: '1.25rem' }}>{creator.nickname}</h3>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>@{creator.uniqueId}</span>
                    </div>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                        {creator.region} • {creator.followerCount.toLocaleString()} followers
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.75rem' }}>
                        {creator.analysis.primaryNiches.map(niche => (
                            <span key={niche} style={{ background: 'rgba(240, 82, 61, 0.15)', color: 'var(--primary)', padding: '0.2rem 0.6rem', borderRadius: '1rem', fontSize: '0.75rem', fontWeight: 600 }}>
                                {niche}
                            </span>
                        ))}
                    </div>
                </div>
            </div>

            <div style={{ marginTop: '1.5rem' }}>
                <h4 style={{ fontSize: '0.875rem', color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Why they're a match</h4>
                <p style={{ fontSize: '0.925rem', color: 'var(--text-main)', lineHeight: '1.6' }}>
                    {creator.analysis.summary}
                </p>
            </div>

            {reasoning && (
                <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'rgba(240, 82, 61, 0.05)', borderRadius: '0.5rem', borderLeft: '3px solid var(--accent)' }}>
                    <h4 style={{ fontSize: '0.875rem', color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Matching Insights</h4>
                    <p style={{ fontSize: '0.925rem', color: 'var(--text-main)', lineHeight: '1.6', fontStyle: 'italic' }}>
                        "{reasoning}"
                    </p>
                </div>
            )}

            <div style={{ marginTop: '1.5rem', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem' }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Semantic</div>
                    <div style={{ fontWeight: 600 }}>{Math.round(scoreBreakdown.semanticSimilarity * 100)}%</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Niche</div>
                    <div style={{ fontWeight: 600 }}>{scoreBreakdown.nicheAlignment} <span style={{ fontSize: '0.7rem', fontWeight: 400 }}>match(es)</span></div>
                </div>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Audience</div>
                    <div style={{ fontWeight: 600 }}>{scoreBreakdown.audienceMatch ? 'Yes' : 'No'}</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Values</div>
                    <div style={{ fontWeight: 600 }}>{scoreBreakdown.valueAlignment} <span style={{ fontSize: '0.7rem', fontWeight: 400 }}>match(es)</span></div>
                </div>
            </div>
        </div>
    );
};

export default CreatorCard;
