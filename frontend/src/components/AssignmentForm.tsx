import React, { useState } from 'react';
import { Assignment } from '../types';

interface Props {
    onSubmit: (assignment: Assignment) => void;
    isLoading: boolean;
}

const AssignmentForm: React.FC<Props> = ({ onSubmit, isLoading }) => {
    const [formData, setFormData] = useState<Assignment>({
        topic: '',
        keyTakeaway: '',
        additionalContext: '',
        creatorNiches: [],
        creatorValues: [],
    });

    const [showOptional, setShowOptional] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.topic || !formData.keyTakeaway || !formData.additionalContext) {
            alert('Please fill in all required fields');
            return;
        }
        onSubmit(formData);
    };

    return (
        <form onSubmit={handleSubmit} className="glass-card animate-fade-in" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>Topic of the Story *</label>
                <input
                    type="text"
                    value={formData.topic}
                    onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
                    placeholder="e.g. Shrinkflation: Less for More!"
                    className="form-input"
                    required
                />
            </div>

            <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>Key Takeaway / Message *</label>
                <textarea
                    value={formData.keyTakeaway}
                    onChange={(e) => setFormData({ ...formData, keyTakeaway: e.target.value })}
                    placeholder="What is the main message?"
                    className="form-input"
                    rows={2}
                    required
                />
            </div>

            <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>Additional Context *</label>
                <textarea
                    value={formData.additionalContext}
                    onChange={(e) => setFormData({ ...formData, additionalContext: e.target.value })}
                    placeholder="Provide background, guidelines, or personal examples..."
                    className="form-input"
                    rows={4}
                    required
                />
            </div>

            <button
                type="button"
                onClick={() => setShowOptional(!showOptional)}
                style={{ background: 'none', border: 'none', color: 'var(--accent)', textAlign: 'left', fontWeight: 600, fontSize: '0.875rem' }}
            >
                {showOptional ? '- Hide Optional Fields' : '+ Show Optional Fields (Targeting, Tone, Values)'}
            </button>

            {showOptional && (
                <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--glass-border)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>Target Audience Locale</label>
                            <input
                                type="text"
                                value={formData.targetAudience?.locale || ''}
                                onChange={(e) => setFormData({ ...formData, targetAudience: { ...formData.targetAudience, locale: e.target.value } })}
                                placeholder="e.g. US, UK, Global"
                                className="form-input"
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>Tone / Style</label>
                            <input
                                type="text"
                                value={formData.toneStyle || ''}
                                onChange={(e) => setFormData({ ...formData, toneStyle: e.target.value })}
                                placeholder="e.g. Conversational, Relatable"
                                className="form-input"
                            />
                        </div>
                    </div>

                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>Creator Niches (comma separated)</label>
                        <input
                            type="text"
                            value={formData.creatorNiches?.join(', ') || ''}
                            onChange={(e) => setFormData({ ...formData, creatorNiches: e.target.value.split(',').map(s => s.trim()).filter(s => s) })}
                            placeholder="e.g. Finance, Lifestyle, Tech"
                            className="form-input"
                        />
                    </div>
                </div>
            )}

            <button
                type="submit"
                disabled={isLoading}
                className="submit-btn"
            >
                {isLoading ? 'Finding Best Matches...' : 'Find Matches'}
            </button>

            <style>{`
        .form-input {
          width: 100%;
          background: #f8fafc;
          border: 1px solid var(--glass-border);
          border-radius: 0.5rem;
          padding: 0.75rem 1rem;
          color: var(--text-main);
          outline: none;
        }
        .form-input:focus {
          border-color: var(--primary);
          box-shadow: 0 0 0 2px rgba(240, 82, 61, 0.1);
        }
        .submit-btn {
          background: var(--primary);
          color: white;
          border: none;
          border-radius: 0.5rem;
          padding: 1rem;
          font-weight: 600;
          font-size: 1rem;
          margin-top: 1rem;
        }
        .submit-btn:hover {
          background: var(--primary-hover);
          transform: translateY(-2px);
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.2);
        }
        .submit-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
          transform: none;
        }
      `}</style>
        </form>
    );
};

export default AssignmentForm;
