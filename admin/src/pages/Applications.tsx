import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';

interface Application {
    id: string;
    status: string;
    form_data: {
        first_name?: string;
        last_name?: string;
        email?: string;
        phone?: string;
    };
    created_at: string;
}

export default function Applications() {
    const [applications, setApplications] = useState<Application[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<string>('');

    useEffect(() => {
        loadApplications();
    }, [filter]);

    async function loadApplications() {
        setLoading(true);
        try {
            const data = await api.getApplications(filter || undefined);
            setApplications(data);
        } catch (error) {
            console.error('Failed to load applications:', error);
        } finally {
            setLoading(false);
        }
    }

    const statusCounts = applications.reduce((acc, app) => {
        acc[app.status] = (acc[app.status] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    const statusColors: Record<string, { bg: string; text: string }> = {
        pending: { bg: '#FFF3CD', text: '#856404' },
        approved: { bg: '#D4EDDA', text: '#155724' },
        declined: { bg: '#F8D7DA', text: '#721C24' },
        hold: { bg: '#E2E3E5', text: '#383D41' },
        onboarding: { bg: '#CCE5FF', text: '#004085' },
    };

    return (
        <div style={{ padding: 'var(--space-4)' }}>
            {/* Header */}
            <div style={{ marginBottom: 'var(--space-4)' }}>
                <h1 style={{
                    fontFamily: 'var(--font-heading)',
                    fontSize: '1.75rem',
                    color: 'var(--dark-gray)',
                    marginBottom: 'var(--space-1)',
                }}>
                    Vetting Hub
                </h1>
                <p style={{ color: 'var(--dark-gray)', opacity: 0.7 }}>
                    Review and process driver applications
                </p>
            </div>

            {/* Filter Buttons */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: 'var(--space-2)',
                marginBottom: 'var(--space-4)',
            }}>
                {[
                    { key: '', label: 'All', count: applications.length },
                    { key: 'pending', label: 'Pending', count: statusCounts['pending'] || 0 },
                    { key: 'approved', label: 'Approved', count: statusCounts['approved'] || 0 },
                    { key: 'declined', label: 'Declined', count: statusCounts['declined'] || 0 },
                ].map((item) => (
                    <button
                        key={item.key}
                        onClick={() => setFilter(item.key)}
                        style={{
                            padding: 'var(--space-3)',
                            background: filter === item.key ? 'var(--primary-blue)' : 'var(--white)',
                            border: `1px solid ${filter === item.key ? 'var(--primary-blue)' : 'var(--medium-gray)'}`,
                            borderRadius: 'var(--radius-standard)',
                            cursor: 'pointer',
                            textAlign: 'left',
                        }}
                    >
                        <div style={{
                            fontSize: '0.75rem',
                            color: filter === item.key ? 'rgba(255,255,255,0.8)' : 'var(--dark-gray)',
                            opacity: filter === item.key ? 1 : 0.6,
                            marginBottom: '4px',
                        }}>
                            {item.label}
                        </div>
                        <div style={{
                            fontSize: '1.5rem',
                            fontWeight: 700,
                            fontFamily: 'var(--font-heading)',
                            color: filter === item.key ? 'var(--white)' : 'var(--dark-gray)',
                        }}>
                            {item.count}
                        </div>
                    </button>
                ))}
            </div>

            {/* Table */}
            <div style={{
                background: 'var(--white)',
                borderRadius: 'var(--radius-standard)',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                overflow: 'hidden',
            }}>
                {loading ? (
                    <div style={{ padding: 'var(--space-4)', textAlign: 'center', color: 'var(--dark-gray)' }}>
                        Loading applications...
                    </div>
                ) : applications.length === 0 ? (
                    <div style={{ padding: 'var(--space-4)', textAlign: 'center', color: 'var(--dark-gray)', opacity: 0.6 }}>
                        No applications found
                    </div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: 'var(--light-gray)' }}>
                                <th style={{ padding: 'var(--space-2) var(--space-3)', textAlign: 'left', color: 'var(--dark-gray)', fontWeight: 600, fontSize: '0.875rem' }}>Applicant</th>
                                <th style={{ padding: 'var(--space-2) var(--space-3)', textAlign: 'left', color: 'var(--dark-gray)', fontWeight: 600, fontSize: '0.875rem' }}>Email</th>
                                <th style={{ padding: 'var(--space-2) var(--space-3)', textAlign: 'left', color: 'var(--dark-gray)', fontWeight: 600, fontSize: '0.875rem' }}>Phone</th>
                                <th style={{ padding: 'var(--space-2) var(--space-3)', textAlign: 'left', color: 'var(--dark-gray)', fontWeight: 600, fontSize: '0.875rem' }}>Submitted</th>
                                <th style={{ padding: 'var(--space-2) var(--space-3)', textAlign: 'left', color: 'var(--dark-gray)', fontWeight: 600, fontSize: '0.875rem' }}>Status</th>
                                <th style={{ padding: 'var(--space-2) var(--space-3)', textAlign: 'right' }}></th>
                            </tr>
                        </thead>
                        <tbody>
                            {applications.map((app) => {
                                const statusStyle = statusColors[app.status] || statusColors.pending;
                                return (
                                    <tr key={app.id} style={{ borderTop: '1px solid var(--light-gray)' }}>
                                        <td style={{ padding: 'var(--space-2) var(--space-3)', fontWeight: 500, color: 'var(--dark-gray)' }}>
                                            {app.form_data?.first_name} {app.form_data?.last_name}
                                        </td>
                                        <td style={{ padding: 'var(--space-2) var(--space-3)', color: 'var(--dark-gray)' }}>
                                            {app.form_data?.email}
                                        </td>
                                        <td style={{ padding: 'var(--space-2) var(--space-3)', color: 'var(--dark-gray)' }}>
                                            {app.form_data?.phone}
                                        </td>
                                        <td style={{ padding: 'var(--space-2) var(--space-3)', color: 'var(--dark-gray)' }}>
                                            {new Date(app.created_at).toLocaleDateString()}
                                        </td>
                                        <td style={{ padding: 'var(--space-2) var(--space-3)' }}>
                                            <span style={{
                                                padding: '4px 8px',
                                                background: statusStyle.bg,
                                                color: statusStyle.text,
                                                borderRadius: 'var(--radius-small)',
                                                fontWeight: 500,
                                                fontSize: '0.75rem',
                                                textTransform: 'capitalize',
                                            }}>
                                                {app.status}
                                            </span>
                                        </td>
                                        <td style={{ padding: 'var(--space-2) var(--space-3)', textAlign: 'right' }}>
                                            <Link
                                                to={`/applications/${app.id}`}
                                                style={{
                                                    padding: '6px 12px',
                                                    background: 'var(--light-gray)',
                                                    border: '1px solid var(--medium-gray)',
                                                    borderRadius: 'var(--radius-small)',
                                                    color: 'var(--dark-gray)',
                                                    textDecoration: 'none',
                                                    fontSize: '0.875rem',
                                                    fontWeight: 500,
                                                }}
                                            >
                                                Review
                                            </Link>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
