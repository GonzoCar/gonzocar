import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';

interface Stats {
    total_payments: number;
    matched_payments: number;
    unmatched_payments: number;
    total_amount: number;
}

interface Application {
    id: string;
    status: string;
    form_data: Record<string, any>;
    created_at: string;
}

interface Driver {
    id: string;
    first_name: string;
    last_name: string;
    balance: number;
}

export default function Dashboard() {
    const [stats, setStats] = useState<Stats | null>(null);
    const [applications, setApplications] = useState<Application[]>([]);
    const [drivers, setDrivers] = useState<Driver[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, []);

    async function loadData() {
        try {
            const [statsData, appsData, driversData] = await Promise.all([
                api.getPaymentStats('weekly'),
                api.getApplications('pending'),
                api.getDrivers(),
            ]);
            setStats(statsData);
            setApplications(appsData.slice(0, 5));
            setDrivers(driversData.slice(0, 5));
        } catch (error) {
            console.error('Failed to load dashboard data:', error);
        } finally {
            setLoading(false);
        }
    }

    if (loading) {
        return <div style={{ padding: 'var(--space-4)', color: 'var(--dark-gray)' }}>Loading dashboard...</div>;
    }

    const statusColors: Record<string, { bg: string; text: string }> = {
        pending: { bg: '#FFF3CD', text: '#856404' },
        approved: { bg: '#D4EDDA', text: '#155724' },
        declined: { bg: '#F8D7DA', text: '#721C24' },
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
                    Dashboard
                </h1>
                <p style={{ color: 'var(--dark-gray)', opacity: 0.7 }}>
                    Overview of your fleet operations
                </p>
            </div>

            {/* Stats Grid */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: 'var(--space-2)',
                marginBottom: 'var(--space-4)',
            }}>
                <div style={{
                    padding: 'var(--space-3)',
                    background: 'var(--primary-blue)',
                    borderRadius: 'var(--radius-standard)',
                }}>
                    <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.8)', marginBottom: '4px' }}>
                        Total Payments
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: 'var(--font-heading)', color: 'var(--white)' }}>
                        ${stats?.total_amount?.toLocaleString() || 0}
                    </div>
                </div>
                <div style={{
                    padding: 'var(--space-3)',
                    background: 'var(--success-green)',
                    borderRadius: 'var(--radius-standard)',
                }}>
                    <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.8)', marginBottom: '4px' }}>
                        Matched Payments
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: 'var(--font-heading)', color: 'var(--white)' }}>
                        {stats?.matched_payments || 0}
                    </div>
                </div>
                <div style={{
                    padding: 'var(--space-3)',
                    background: '#F59E0B',
                    borderRadius: 'var(--radius-standard)',
                }}>
                    <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.8)', marginBottom: '4px' }}>
                        Pending Review
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: 'var(--font-heading)', color: 'var(--white)' }}>
                        {stats?.unmatched_payments || 0}
                    </div>
                </div>
                <div style={{
                    padding: 'var(--space-3)',
                    background: 'var(--white)',
                    border: '1px solid var(--medium-gray)',
                    borderRadius: 'var(--radius-standard)',
                }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--dark-gray)', opacity: 0.6, marginBottom: '4px' }}>
                        Active Drivers
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: 'var(--font-heading)', color: 'var(--dark-gray)' }}>
                        {drivers.length}
                    </div>
                </div>
            </div>

            {/* Two Column Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                {/* Pending Applications */}
                <div style={{
                    background: 'var(--white)',
                    borderRadius: 'var(--radius-standard)',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                    overflow: 'hidden',
                }}>
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: 'var(--space-3)',
                        borderBottom: '1px solid var(--light-gray)',
                    }}>
                        <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem', color: 'var(--dark-gray)' }}>
                            Pending Applications
                        </h3>
                        <Link
                            to="/applications"
                            style={{
                                padding: '4px 12px',
                                background: 'var(--light-gray)',
                                border: '1px solid var(--medium-gray)',
                                borderRadius: 'var(--radius-small)',
                                color: 'var(--dark-gray)',
                                textDecoration: 'none',
                                fontSize: '0.75rem',
                            }}
                        >
                            View All
                        </Link>
                    </div>
                    {applications.length === 0 ? (
                        <div style={{ padding: 'var(--space-4)', textAlign: 'center', color: 'var(--dark-gray)', opacity: 0.6 }}>
                            No pending applications
                        </div>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: 'var(--light-gray)' }}>
                                    <th style={{ padding: 'var(--space-2) var(--space-3)', textAlign: 'left', color: 'var(--dark-gray)', fontWeight: 600, fontSize: '0.75rem' }}>Name</th>
                                    <th style={{ padding: 'var(--space-2) var(--space-3)', textAlign: 'left', color: 'var(--dark-gray)', fontWeight: 600, fontSize: '0.75rem' }}>Date</th>
                                    <th style={{ padding: 'var(--space-2) var(--space-3)', textAlign: 'left', color: 'var(--dark-gray)', fontWeight: 600, fontSize: '0.75rem' }}>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {applications.map((app) => {
                                    const statusStyle = statusColors[app.status] || statusColors.pending;
                                    return (
                                        <tr key={app.id} style={{ borderTop: '1px solid var(--light-gray)' }}>
                                            <td style={{ padding: 'var(--space-2) var(--space-3)' }}>
                                                <Link to={`/applications/${app.id}`} style={{ color: 'var(--primary-blue)', textDecoration: 'none', fontWeight: 500 }}>
                                                    {(() => {
                                                        const fd = app.form_data || {};
                                                        if (fd.first_name || fd.last_name) return `${fd.first_name || ''} ${fd.last_name || ''}`;

                                                        // Deep search for names
                                                        let namesObj: any = null;
                                                        for (const key of Object.keys(fd)) {
                                                            if (key.toLowerCase().includes('name') && typeof (fd as any)[key] === 'object') {
                                                                namesObj = (fd as any)[key];
                                                                break;
                                                            }
                                                        }
                                                        if (namesObj) {
                                                            const f = namesObj.first_name || namesObj.First_Name || namesObj.first || '';
                                                            const l = namesObj.last_name || namesObj.Last_Name || namesObj.last || '';
                                                            if (f || l) return `${f} ${l}`;
                                                        }

                                                        return fd.email || 'Unknown Applicant';
                                                    })()}
                                                </Link>
                                            </td>
                                            <td style={{ padding: 'var(--space-2) var(--space-3)', color: 'var(--dark-gray)', fontSize: '0.875rem' }}>
                                                {new Date(app.created_at).toLocaleDateString()}
                                            </td>
                                            <td style={{ padding: 'var(--space-2) var(--space-3)' }}>
                                                <span style={{
                                                    padding: '2px 8px',
                                                    background: statusStyle.bg,
                                                    color: statusStyle.text,
                                                    borderRadius: '4px',
                                                    fontSize: '0.75rem',
                                                    fontWeight: 500,
                                                    textTransform: 'capitalize',
                                                }}>
                                                    {app.status}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Driver Balances */}
                <div style={{
                    background: 'var(--white)',
                    borderRadius: 'var(--radius-standard)',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                    overflow: 'hidden',
                }}>
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: 'var(--space-3)',
                        borderBottom: '1px solid var(--light-gray)',
                    }}>
                        <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem', color: 'var(--dark-gray)' }}>
                            Driver Balances
                        </h3>
                        <Link
                            to="/drivers"
                            style={{
                                padding: '4px 12px',
                                background: 'var(--light-gray)',
                                border: '1px solid var(--medium-gray)',
                                borderRadius: 'var(--radius-small)',
                                color: 'var(--dark-gray)',
                                textDecoration: 'none',
                                fontSize: '0.75rem',
                            }}
                        >
                            View All
                        </Link>
                    </div>
                    {drivers.length === 0 ? (
                        <div style={{ padding: 'var(--space-4)', textAlign: 'center', color: 'var(--dark-gray)', opacity: 0.6 }}>
                            No drivers yet
                        </div>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: 'var(--light-gray)' }}>
                                    <th style={{ padding: 'var(--space-2) var(--space-3)', textAlign: 'left', color: 'var(--dark-gray)', fontWeight: 600, fontSize: '0.75rem' }}>Driver</th>
                                    <th style={{ padding: 'var(--space-2) var(--space-3)', textAlign: 'right', color: 'var(--dark-gray)', fontWeight: 600, fontSize: '0.75rem' }}>Balance</th>
                                </tr>
                            </thead>
                            <tbody>
                                {drivers.map((driver) => (
                                    <tr key={driver.id} style={{ borderTop: '1px solid var(--light-gray)' }}>
                                        <td style={{ padding: 'var(--space-2) var(--space-3)' }}>
                                            <Link to={`/drivers/${driver.id}`} style={{ color: 'var(--primary-blue)', textDecoration: 'none', fontWeight: 500 }}>
                                                {driver.first_name || driver.last_name
                                                    ? `${driver.first_name} ${driver.last_name}`.trim()
                                                    : <span style={{ opacity: 0.6, fontStyle: 'italic' }}>{driver.email?.split('@')[0] || driver.email}</span>
                                                }
                                            </Link>
                                        </td>
                                        <td style={{
                                            padding: 'var(--space-2) var(--space-3)',
                                            textAlign: 'right',
                                            fontWeight: 600,
                                            color: (driver.balance || 0) >= 0 ? 'var(--success-green)' : 'var(--error-red)',
                                        }}>
                                            ${driver.balance?.toFixed(2) || '0.00'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
}
