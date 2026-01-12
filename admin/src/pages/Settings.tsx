import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

interface SystemStatus {
    database: { status: string; message: string };
    openphone: { status: string; message: string };
    gmail: { status: string; message: string };
}

export default function Settings() {
    const { user } = useAuth();
    const [status, setStatus] = useState<SystemStatus | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadStatus();
    }, []);

    async function loadStatus() {
        try {
            const data = await api.getSystemStatus();
            setStatus(data);
        } catch (error) {
            console.error('Failed to load status:', error);
        } finally {
            setLoading(false);
        }
    }

    function getStatusBadge(s: { status: string; message: string } | undefined) {
        if (!s) return <span className="badge pending">Loading...</span>;

        const badgeClass = s.status === 'ok' ? 'approved' :
            s.status === 'warning' ? 'hold' : 'declined';
        return <span className={`badge ${badgeClass}`}>{s.message}</span>;
    }

    return (
        <div>
            <div className="page-header">
                <h1>Settings</h1>
                <p>System configuration and staff management</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                <div className="card">
                    <h3 className="card-title" style={{ marginBottom: '1rem' }}>Your Profile</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div>
                            <div style={{ color: '#666', fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                                Name
                            </div>
                            <div style={{ color: '#333', fontSize: '1.1rem' }}>{user?.name}</div>
                        </div>
                        <div>
                            <div style={{ color: '#666', fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                                Email
                            </div>
                            <div style={{ color: '#333' }}>{user?.email}</div>
                        </div>
                        <div>
                            <div style={{ color: '#666', fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                                Role
                            </div>
                            <span className={`badge ${user?.role === 'admin' ? 'approved' : 'pending'}`} style={{ textTransform: 'capitalize' }}>
                                {user?.role}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="card">
                    <h3 className="card-title" style={{ marginBottom: '1rem' }}>
                        System Status
                        {!loading && (
                            <button
                                onClick={loadStatus}
                                style={{
                                    marginLeft: '1rem',
                                    background: '#f0f0f0',
                                    border: '1px solid #ccc',
                                    borderRadius: '4px',
                                    padding: '0.25rem 0.5rem',
                                    color: '#1E4D8C',
                                    cursor: 'pointer',
                                    fontSize: '0.75rem'
                                }}
                            >
                                Refresh
                            </button>
                        )}
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: '#333' }}>Backend API</span>
                            <span className="badge approved">Connected</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: '#333' }}>Database</span>
                            {getStatusBadge(status?.database)}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: '#333' }}>Gmail API</span>
                            {getStatusBadge(status?.gmail)}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: '#333' }}>OpenPhone SMS</span>
                            {getStatusBadge(status?.openphone)}
                        </div>
                    </div>
                </div>

                <div className="card" style={{ gridColumn: 'span 2' }}>
                    <h3 className="card-title" style={{ marginBottom: '1rem' }}>Cron Jobs</h3>
                    <div className="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>Job</th>
                                    <th>Schedule</th>
                                    <th>Description</th>
                                    <th>Command</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td style={{ fontWeight: 500, color: '#333' }}>Payment Parser</td>
                                    <td><code style={{ background: '#f0f0f0', padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', color: '#333' }}>*/5 * * * *</code></td>
                                    <td>Parse payment emails from Gmail every 5 minutes</td>
                                    <td><code style={{ color: '#1E4D8C', fontSize: '0.75rem' }}>python scripts/parse_payments.py</code></td>
                                </tr>
                                <tr>
                                    <td style={{ fontWeight: 500, color: '#333' }}>Midnight Billing</td>
                                    <td><code style={{ background: '#f0f0f0', padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', color: '#333' }}>0 0 * * *</code></td>
                                    <td>Create daily debits, check late payments, send SMS</td>
                                    <td><code style={{ color: '#1E4D8C', fontSize: '0.75rem' }}>python scripts/midnight_billing.py</code></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
