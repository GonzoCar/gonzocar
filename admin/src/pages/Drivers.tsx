import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';

interface Driver {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    billing_type: string;
    billing_rate: number;
    billing_active: boolean;
    balance: number;
    created_at: string;
}

export default function Drivers() {
    const [drivers, setDrivers] = useState<Driver[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    useEffect(() => {
        loadDrivers();
    }, []);

    async function loadDrivers() {
        try {
            const data = await api.getDrivers();
            setDrivers(data);
        } catch (error) {
            console.error('Failed to load drivers:', error);
        } finally {
            setLoading(false);
        }
    }

    const filteredDrivers = drivers.filter((d) =>
        `${d.first_name} ${d.last_name} ${d.email}`.toLowerCase().includes(search.toLowerCase())
    );

    const totalBalance = drivers.reduce((sum, d) => sum + (d.balance || 0), 0);
    const activeDrivers = drivers.filter((d) => d.billing_active).length;

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
                    Drivers
                </h1>
                <p style={{ color: 'var(--dark-gray)', opacity: 0.7 }}>
                    Manage your fleet drivers
                </p>
            </div>

            {/* Stats */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 'var(--space-2)',
                marginBottom: 'var(--space-4)',
            }}>
                <div style={{
                    padding: 'var(--space-3)',
                    background: 'var(--white)',
                    border: '1px solid var(--medium-gray)',
                    borderRadius: 'var(--radius-standard)',
                }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--dark-gray)', opacity: 0.6, marginBottom: '4px' }}>
                        Total Drivers
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: 'var(--font-heading)', color: 'var(--dark-gray)' }}>
                        {drivers.length}
                    </div>
                </div>
                <div style={{
                    padding: 'var(--space-3)',
                    background: 'var(--white)',
                    border: '1px solid var(--medium-gray)',
                    borderRadius: 'var(--radius-standard)',
                }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--dark-gray)', opacity: 0.6, marginBottom: '4px' }}>
                        Active Billing
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: 'var(--font-heading)', color: 'var(--success-green)' }}>
                        {activeDrivers}
                    </div>
                </div>
                <div style={{
                    padding: 'var(--space-3)',
                    background: 'var(--white)',
                    border: '1px solid var(--medium-gray)',
                    borderRadius: 'var(--radius-standard)',
                }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--dark-gray)', opacity: 0.6, marginBottom: '4px' }}>
                        Total Balance
                    </div>
                    <div style={{
                        fontSize: '1.5rem',
                        fontWeight: 700,
                        fontFamily: 'var(--font-heading)',
                        color: totalBalance >= 0 ? 'var(--success-green)' : 'var(--error-red)',
                    }}>
                        ${totalBalance.toFixed(2)}
                    </div>
                </div>
            </div>

            {/* Table */}
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
                        All Drivers
                    </h3>
                    <input
                        type="text"
                        placeholder="Search drivers..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        style={{
                            padding: 'var(--space-1) var(--space-2)',
                            border: '1px solid var(--medium-gray)',
                            borderRadius: 'var(--radius-small)',
                            color: 'var(--dark-gray)',
                            width: '250px',
                            fontSize: '0.875rem',
                        }}
                    />
                </div>

                {loading ? (
                    <div style={{ padding: 'var(--space-4)', textAlign: 'center', color: 'var(--dark-gray)' }}>
                        Loading drivers...
                    </div>
                ) : filteredDrivers.length === 0 ? (
                    <div style={{ padding: 'var(--space-4)', textAlign: 'center', color: 'var(--dark-gray)', opacity: 0.6 }}>
                        No drivers found
                    </div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: 'var(--light-gray)' }}>
                                <th style={{ padding: 'var(--space-2) var(--space-3)', textAlign: 'left', color: 'var(--dark-gray)', fontWeight: 600, fontSize: '0.875rem' }}>Name</th>
                                <th style={{ padding: 'var(--space-2) var(--space-3)', textAlign: 'left', color: 'var(--dark-gray)', fontWeight: 600, fontSize: '0.875rem' }}>Contact</th>
                                <th style={{ padding: 'var(--space-2) var(--space-3)', textAlign: 'left', color: 'var(--dark-gray)', fontWeight: 600, fontSize: '0.875rem' }}>Billing</th>
                                <th style={{ padding: 'var(--space-2) var(--space-3)', textAlign: 'left', color: 'var(--dark-gray)', fontWeight: 600, fontSize: '0.875rem' }}>Status</th>
                                <th style={{ padding: 'var(--space-2) var(--space-3)', textAlign: 'right', color: 'var(--dark-gray)', fontWeight: 600, fontSize: '0.875rem' }}>Balance</th>
                                <th style={{ padding: 'var(--space-2) var(--space-3)', textAlign: 'right' }}></th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredDrivers.map((driver) => (
                                <tr key={driver.id} style={{ borderTop: '1px solid var(--light-gray)' }}>
                                    <td style={{ padding: 'var(--space-2) var(--space-3)', fontWeight: 500, color: 'var(--dark-gray)' }}>
                                        {driver.first_name} {driver.last_name}
                                    </td>
                                    <td style={{ padding: 'var(--space-2) var(--space-3)' }}>
                                        <div style={{ color: 'var(--dark-gray)' }}>{driver.email}</div>
                                        <div style={{ color: 'var(--dark-gray)', opacity: 0.6, fontSize: '0.75rem' }}>{driver.phone}</div>
                                    </td>
                                    <td style={{ padding: 'var(--space-2) var(--space-3)', color: 'var(--dark-gray)' }}>
                                        ${driver.billing_rate}/{driver.billing_type}
                                    </td>
                                    <td style={{ padding: 'var(--space-2) var(--space-3)' }}>
                                        <span style={{
                                            padding: '4px 8px',
                                            background: driver.billing_active ? '#D4EDDA' : '#E2E3E5',
                                            color: driver.billing_active ? '#155724' : '#383D41',
                                            borderRadius: 'var(--radius-small)',
                                            fontWeight: 500,
                                            fontSize: '0.75rem',
                                        }}>
                                            {driver.billing_active ? 'Active' : 'Paused'}
                                        </span>
                                    </td>
                                    <td style={{
                                        padding: 'var(--space-2) var(--space-3)',
                                        textAlign: 'right',
                                        fontWeight: 600,
                                        color: (driver.balance || 0) >= 0 ? 'var(--success-green)' : 'var(--error-red)',
                                    }}>
                                        ${driver.balance?.toFixed(2) || '0.00'}
                                    </td>
                                    <td style={{ padding: 'var(--space-2) var(--space-3)', textAlign: 'right' }}>
                                        <Link
                                            to={`/drivers/${driver.id}`}
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
                                            View
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
