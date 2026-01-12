import { useState, useEffect } from 'react';

interface SendModalProps {
    isOpen: boolean;
    title: string;
    defaultMessage: string;
    onCancel: () => void;
    onConfirm: (message: string) => void;
    loading?: boolean;
}

const MESSAGE_TEMPLATES: Record<string, string> = {
    approved: `Congratulations! Your application has been approved. Welcome to GonzoFleet! We will be in touch shortly with next steps for onboarding.`,
    hold: `Your application is currently on hold. We need additional information to proceed. Please contact us at your earliest convenience.`,
    declined: `We regret to inform you that your application has been declined at this time. If you have any questions, please feel free to reach out.`,
    onboarding: `Welcome to the team! Your onboarding process has begun. Please check your email for further instructions.`,
};

export function getMessageTemplate(status: string): string {
    return MESSAGE_TEMPLATES[status] || '';
}

export default function SendModal({ isOpen, title, defaultMessage, onCancel, onConfirm, loading }: SendModalProps) {
    const [message, setMessage] = useState(defaultMessage);

    useEffect(() => {
        setMessage(defaultMessage);
    }, [defaultMessage, isOpen]);

    if (!isOpen) return null;

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
        }}>
            <div style={{
                background: 'var(--white)',
                borderRadius: 'var(--radius-standard)',
                padding: 'var(--space-4)',
                width: '100%',
                maxWidth: '500px',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
            }}>
                <h3 style={{
                    fontFamily: 'var(--font-heading)',
                    fontSize: '1.25rem',
                    color: 'var(--dark-gray)',
                    marginBottom: 'var(--space-3)',
                }}>
                    {title}
                </h3>

                <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    style={{
                        width: '100%',
                        minHeight: '150px',
                        padding: 'var(--space-2)',
                        border: '1px solid var(--medium-gray)',
                        borderRadius: 'var(--radius-small)',
                        fontSize: '0.875rem',
                        color: 'var(--dark-gray)',
                        resize: 'vertical',
                        marginBottom: 'var(--space-3)',
                        boxSizing: 'border-box',
                    }}
                    placeholder="Enter message to send..."
                />

                <div style={{
                    display: 'flex',
                    gap: 'var(--space-2)',
                    justifyContent: 'flex-end',
                }}>
                    <button
                        onClick={onCancel}
                        disabled={loading}
                        style={{
                            padding: 'var(--space-2) var(--space-3)',
                            background: 'var(--light-gray)',
                            border: '1px solid var(--medium-gray)',
                            borderRadius: 'var(--radius-small)',
                            color: 'var(--dark-gray)',
                            fontWeight: 500,
                            cursor: loading ? 'not-allowed' : 'pointer',
                            opacity: loading ? 0.6 : 1,
                        }}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => onConfirm(message)}
                        disabled={loading || !message.trim()}
                        style={{
                            padding: 'var(--space-2) var(--space-3)',
                            background: 'var(--primary-blue)',
                            border: 'none',
                            borderRadius: 'var(--radius-small)',
                            color: 'var(--white)',
                            fontWeight: 500,
                            cursor: loading || !message.trim() ? 'not-allowed' : 'pointer',
                            opacity: loading || !message.trim() ? 0.6 : 1,
                        }}
                    >
                        {loading ? 'Sending...' : 'Send & Confirm'}
                    </button>
                </div>
            </div>
        </div>
    );
}
