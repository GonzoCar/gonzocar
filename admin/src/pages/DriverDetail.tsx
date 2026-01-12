import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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

interface LedgerEntry {
    id: string;
    type: string;
    amount: number;
    description: string;
    created_at: string;
}

interface Alias {
    id: string;
    alias_type: string;
    alias_value: string;
}

export default function DriverDetail() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [driver, setDriver] = useState<Driver | null>(null);
    const [ledger, setLedger] = useState<LedgerEntry[]>([]);
    const [aliases, setAliases] = useState<Alias[]>([]);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);

    useEffect(() => {
        if (id) loadData();
    }, [id]);

    async function loadData() {
        try {
            const [driverData, ledgerData, aliasData] = await Promise.all([
                api.getDriver(id!),
                api.getDriverLedger(id!),
                api.getDriverAliases(id!),
            ]);
            setDriver(driverData);
            setLedger(ledgerData);
            setAliases(aliasData);
        } catch (error) {
            console.error('Failed to load driver:', error);
        } finally {
            setLoading(false);
        }
    }

    async function toggleBilling() {
        if (!driver) return;
        setUpdating(true);
        try {
            await api.updateDriverBilling(driver.id, !driver.billing_active);
            loadData();
        } catch (error) {
            console.error('Failed to update billing:', error);
        } finally {
            setUpdating(false);
        }
    }

    if (loading) {
        return <div style={{ padding: 'var(--space-4)', color: 'var(--dark-gray)' }}>Loading driver...</div>;
    }

    if (!driver) {
        return <div style={{ padding: 'var(--space-4)', color: 'var(--dark-gray)' }}>Driver not found</div>;
    }

    return (
        <div style={{ padding: 'var(--space-4)' }}>
            {/* Header */}
            <div style={{ marginBottom: 'var(--space-4)' }}>
                <button
                    onClick={() => navigate('/drivers')}
                    style={{
                        padding: 'var(--space-1) var(--space-2)',
                        background: 'var(--light-gray)',
                        border: '1px solid var(--medium-gray)',
                        borderRadius: 'var(--radius-small)',
                        color: 'var(--dark-gray)',
                        marginBottom: 'var(--space-2)',
                        cursor: 'pointer',
                    }}
                >
                    Back to Drivers
                </button>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <h1 style={{
                            fontFamily: 'var(--font-heading)',
                            fontSize: '1.75rem',
                            color: 'var(--dark-gray)',
                            marginBottom: 'var(--space-1)',
                        }}>
                            {driver.first_name} {driver.last_name}
                        </h1>
                        <p style={{ color: 'var(--dark-gray)', opacity: 0.7 }}>
                            Driver since {new Date(driver.created_at).toLocaleDateString()}
                        </p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <div style={{
                            fontSize: '2rem',
                            fontWeight: 700,
                            fontFamily: 'var(--font-heading)',
                            color: (driver.balance || 0) >= 0 ? 'var(--success-green)' : 'var(--error-red)',
                        }}>
                            ${driver.balance?.toFixed(2) || '0.00'}
                        </div>
                        <div style={{ color: 'var(--dark-gray)', opacity: 0.6, fontSize: '0.875rem' }}>
                            Current Balance
                        </div>
                    </div>
                </div>
            </div>

            {/* Info Cards */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 'var(--space-3)',
                marginBottom: 'var(--space-4)',
            }}>
                <div style={{
                    background: 'var(--white)',
                    borderRadius: 'var(--radius-standard)',
                    padding: 'var(--space-3)',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--dark-gray)', opacity: 0.6, marginBottom: '8px' }}>
                        Contact
                    </div>
                    <div style={{ color: 'var(--dark-gray)', fontWeight: 500 }}>{driver.email}</div>
                    <div style={{ color: 'var(--dark-gray)', opacity: 0.7 }}>{driver.phone}</div>
                </div>
                <div style={{
                    background: 'var(--white)',
                    borderRadius: 'var(--radius-standard)',
                    padding: 'var(--space-3)',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--dark-gray)', opacity: 0.6, marginBottom: '8px' }}>
                        Billing Rate
                    </div>
                    <div style={{ color: 'var(--dark-gray)', fontSize: '1.25rem', fontWeight: 600 }}>
                        ${driver.billing_rate} / {driver.billing_type}
                    </div>
                </div>
                <div style={{
                    background: 'var(--white)',
                    borderRadius: 'var(--radius-standard)',
                    padding: 'var(--space-3)',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--dark-gray)', opacity: 0.6, marginBottom: '8px' }}>
                        Billing Status
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                        <span style={{
                            padding: '4px 8px',
                            background: driver.billing_active ? '#D4EDDA' : '#E2E3E5',
                            color: driver.billing_active ? '#155724' : '#383D41',
                            borderRadius: 'var(--radius-small)',
                            fontWeight: 500,
                            fontSize: '0.875rem',
                        }}>
                            {driver.billing_active ? 'Active' : 'Paused'}
                        </span>
                        <button
                            onClick={toggleBilling}
                            disabled={updating}
                            style={{
                                padding: '4px 12px',
                                background: 'var(--light-gray)',
                                border: '1px solid var(--medium-gray)',
                                borderRadius: 'var(--radius-small)',
                                color: 'var(--dark-gray)',
                                fontSize: '0.75rem',
                                cursor: updating ? 'not-allowed' : 'pointer',
                                opacity: updating ? 0.6 : 1,
                            }}
                        >
                            {driver.billing_active ? 'Pause' : 'Resume'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Two Column Layout */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 'var(--space-4)' }}>
                {/* Ledger History */}
                <div style={{
                    background: 'var(--white)',
                    borderRadius: 'var(--radius-standard)',
                    padding: 'var(--space-3)',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                }}>
                    <h3 style={{
                        fontFamily: 'var(--font-heading)',
                        fontSize: '1rem',
                        color: 'var(--dark-gray)',
                        marginBottom: 'var(--space-3)',
                    }}>
                        Ledger History
                    </h3>
                    {ledger.length === 0 ? (
                        <p style={{ color: 'var(--dark-gray)', opacity: 0.6 }}>No transactions yet</p>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: 'var(--light-gray)' }}>
                                    <th style={{ padding: 'var(--space-2)', textAlign: 'left', color: 'var(--dark-gray)', fontWeight: 600, fontSize: '0.75rem' }}>Date</th>
                                    <th style={{ padding: 'var(--space-2)', textAlign: 'left', color: 'var(--dark-gray)', fontWeight: 600, fontSize: '0.75rem' }}>Description</th>
                                    <th style={{ padding: 'var(--space-2)', textAlign: 'left', color: 'var(--dark-gray)', fontWeight: 600, fontSize: '0.75rem' }}>Type</th>
                                    <th style={{ padding: 'var(--space-2)', textAlign: 'right', color: 'var(--dark-gray)', fontWeight: 600, fontSize: '0.75rem' }}>Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                {ledger.map((entry) => (
                                    <tr key={entry.id} style={{ borderTop: '1px solid var(--light-gray)' }}>
                                        <td style={{ padding: 'var(--space-2)', color: 'var(--dark-gray)', fontSize: '0.875rem' }}>
                                            {new Date(entry.created_at).toLocaleDateString()}
                                        </td>
                                        <td style={{ padding: 'var(--space-2)', color: 'var(--dark-gray)', fontSize: '0.875rem' }}>
                                            {entry.description}
                                        </td>
                                        <td style={{ padding: 'var(--space-2)' }}>
                                            <span style={{
                                                padding: '2px 6px',
                                                background: entry.type === 'credit' ? '#D4EDDA' : '#F8D7DA',
                                                color: entry.type === 'credit' ? '#155724' : '#721C24',
                                                borderRadius: '4px',
                                                fontSize: '0.75rem',
                                                fontWeight: 500,
                                            }}>
                                                {entry.type}
                                            </span>
                                        </td>
                                        <td style={{
                                            padding: 'var(--space-2)',
                                            textAlign: 'right',
                                            fontWeight: 600,
                                            fontSize: '0.875rem',
                                            color: entry.type === 'credit' ? 'var(--success-green)' : 'var(--error-red)',
                                        }}>
                                            {entry.type === 'credit' ? '+' : '-'}${entry.amount.toFixed(2)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Payment Aliases */}
                <div style={{
                    background: 'var(--white)',
                    borderRadius: 'var(--radius-standard)',
                    padding: 'var(--space-3)',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                }}>
                    <h3 style={{
                        fontFamily: 'var(--font-heading)',
                        fontSize: '1rem',
                        color: 'var(--dark-gray)',
                        marginBottom: 'var(--space-3)',
                    }}>
                        Payment Aliases
                    </h3>
                    {aliases.length === 0 ? (
                        <p style={{ color: 'var(--dark-gray)', opacity: 0.6, fontSize: '0.875rem' }}>
                            No aliases configured
                        </p>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                            {aliases.map((alias) => (
                                <div key={alias.id} style={{
                                    padding: 'var(--space-2)',
                                    background: 'var(--light-gray)',
                                    borderRadius: 'var(--radius-small)',
                                }}>
                                    <div style={{
                                        color: 'var(--dark-gray)',
                                        opacity: 0.6,
                                        fontSize: '0.65rem',
                                        textTransform: 'uppercase',
                                        marginBottom: '2px',
                                    }}>
                                        {alias.alias_type}
                                    </div>
                                    <div style={{ color: 'var(--dark-gray)', fontSize: '0.875rem' }}>
                                        {alias.alias_value}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
