import { useEffect, useState } from 'react';
import api from '../services/api';

interface Payment {
    id: string;
    source: string;
    amount: number;
    sender_name: string;
    sender_identifier: string | null;
    transaction_id: string | null;
    memo: string | null;
    received_at: string;
    matched: boolean;
    driver_id: string | null;
}

interface Driver {
    id: string;
    first_name: string;
    last_name: string;
}

interface Stats {
    total_payments: number;
    matched_payments: number;
    unmatched_payments: number;
    total_amount: number;
    matched_amount: number;
}

export default function Payments() {
    const [payments, setPayments] = useState<Payment[]>([]);
    const [drivers, setDrivers] = useState<Driver[]>([]);
    const [stats, setStats] = useState<Stats | null>(null);
    const [loading, setLoading] = useState(true);
    const [assigning, setAssigning] = useState<string | null>(null);
    const [selectedDriver, setSelectedDriver] = useState<string>('');

    useEffect(() => {
        loadData();
    }, []);

    async function loadData() {
        try {
            const [paymentsData, driversData, statsData] = await Promise.all([
                api.getUnrecognizedPayments(),
                api.getDrivers(),
                api.getPaymentStats(),
            ]);
            setPayments(paymentsData);
            setDrivers(driversData);
            setStats(statsData);
        } catch (error) {
            console.error('Failed to load data:', error);
        } finally {
            setLoading(false);
        }
    }

    async function handleAssign(paymentId: string) {
        if (!selectedDriver) return;
        try {
            await api.assignPayment(paymentId, selectedDriver, true);
            setAssigning(null);
            setSelectedDriver('');
            loadData();
        } catch (error) {
            console.error('Failed to assign payment:', error);
        }
    }

    const sourceColors: Record<string, { bg: string; text: string }> = {
        zelle: { bg: '#EEF2FF', text: '#4F46E5' },
        venmo: { bg: '#DBEAFE', text: '#2563EB' },
        cashapp: { bg: '#DCFCE7', text: '#16A34A' },
        chime: { bg: '#CCFBF1', text: '#0D9488' },
        stripe: { bg: '#EDE9FE', text: '#7C3AED' },
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
                    Payments
                </h1>
                <p style={{ color: 'var(--dark-gray)', opacity: 0.7 }}>
                    Review and assign unrecognized payments
                </p>
            </div>

            {/* Stats Grid */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 'var(--space-2)',
                marginBottom: 'var(--space-4)',
            }}>
                <div style={{
                    padding: 'var(--space-3)',
                    background: 'var(--primary-blue)',
                    borderRadius: 'var(--radius-standard)',
                }}>
                    <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.8)', marginBottom: '4px' }}>
                        Total Amount
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
                        Matched
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
                        Unmatched
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: 'var(--font-heading)', color: 'var(--white)' }}>
                        {stats?.unmatched_payments || 0}
                    </div>
                </div>
            </div>

            {/* Table Card */}
            <div style={{
                background: 'var(--white)',
                borderRadius: 'var(--radius-standard)',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                overflow: 'hidden',
            }}>
                <div style={{
                    padding: 'var(--space-3)',
                    borderBottom: '1px solid var(--light-gray)',
                }}>
                    <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem', color: 'var(--dark-gray)' }}>
                        Unrecognized Payments
                    </h3>
                </div>

                {loading ? (
                    <div style={{ padding: 'var(--space-4)', textAlign: 'center', color: 'var(--dark-gray)' }}>
                        Loading payments...
                    </div>
                ) : payments.length === 0 ? (
                    <div style={{ padding: 'var(--space-4)', textAlign: 'center', color: 'var(--dark-gray)', opacity: 0.6 }}>
                        All payments have been matched!
                    </div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: 'var(--light-gray)' }}>
                                <th style={{ padding: 'var(--space-2) var(--space-3)', textAlign: 'left', color: 'var(--dark-gray)', fontWeight: 600, fontSize: '0.75rem' }}>Source</th>
                                <th style={{ padding: 'var(--space-2) var(--space-3)', textAlign: 'left', color: 'var(--dark-gray)', fontWeight: 600, fontSize: '0.75rem' }}>Sender</th>
                                <th style={{ padding: 'var(--space-2) var(--space-3)', textAlign: 'left', color: 'var(--dark-gray)', fontWeight: 600, fontSize: '0.75rem' }}>Memo</th>
                                <th style={{ padding: 'var(--space-2) var(--space-3)', textAlign: 'left', color: 'var(--dark-gray)', fontWeight: 600, fontSize: '0.75rem' }}>Date</th>
                                <th style={{ padding: 'var(--space-2) var(--space-3)', textAlign: 'right', color: 'var(--dark-gray)', fontWeight: 600, fontSize: '0.75rem' }}>Amount</th>
                                <th style={{ padding: 'var(--space-2) var(--space-3)', textAlign: 'left', color: 'var(--dark-gray)', fontWeight: 600, fontSize: '0.75rem' }}>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {payments.map((payment) => {
                                const sourceStyle = sourceColors[payment.source] || sourceColors.zelle;
                                return (
                                    <tr key={payment.id} style={{ borderTop: '1px solid var(--light-gray)' }}>
                                        <td style={{ padding: 'var(--space-2) var(--space-3)' }}>
                                            <span style={{
                                                display: 'inline-block',
                                                padding: '4px 8px',
                                                background: sourceStyle.bg,
                                                color: sourceStyle.text,
                                                borderRadius: '9999px',
                                                fontSize: '0.75rem',
                                                fontWeight: 500,
                                                textTransform: 'uppercase',
                                            }}>
                                                {payment.source}
                                            </span>
                                        </td>
                                        <td style={{ padding: 'var(--space-2) var(--space-3)', fontWeight: 500, color: 'var(--dark-gray)' }}>
                                            {payment.sender_name}
                                        </td>
                                        <td style={{ padding: 'var(--space-2) var(--space-3)', color: 'var(--dark-gray)', opacity: 0.7, fontSize: '0.875rem' }}>
                                            {payment.memo || '-'}
                                        </td>
                                        <td style={{ padding: 'var(--space-2) var(--space-3)', color: 'var(--dark-gray)', fontSize: '0.875rem' }}>
                                            {new Date(payment.received_at).toLocaleString('en-US', {
                                                month: 'numeric',
                                                day: 'numeric',
                                                year: 'numeric',
                                                hour: 'numeric',
                                                minute: 'numeric',
                                                hour12: true
                                            })}
                                        </td>
                                        <td style={{ padding: 'var(--space-2) var(--space-3)', textAlign: 'right', fontWeight: 600, color: 'var(--success-green)' }}>
                                            ${payment.amount.toFixed(2)}
                                        </td>
                                        <td style={{ padding: 'var(--space-2) var(--space-3)' }}>
                                            {assigning === payment.id ? (
                                                <div style={{ display: 'flex', gap: 'var(--space-1)', alignItems: 'center' }}>
                                                    <select
                                                        value={selectedDriver}
                                                        onChange={(e) => setSelectedDriver(e.target.value)}
                                                        style={{
                                                            padding: '4px 8px',
                                                            border: '1px solid var(--medium-gray)',
                                                            borderRadius: 'var(--radius-small)',
                                                            color: 'var(--dark-gray)',
                                                            fontSize: '0.75rem',
                                                            background: 'var(--white)',
                                                        }}
                                                    >
                                                        <option value="">Select driver...</option>
                                                        {drivers.map((d) => (
                                                            <option key={d.id} value={d.id}>
                                                                {d.first_name} {d.last_name}
                                                            </option>
                                                        ))}
                                                    </select>
                                                    <button
                                                        onClick={() => handleAssign(payment.id)}
                                                        disabled={!selectedDriver}
                                                        style={{
                                                            padding: '4px 8px',
                                                            background: 'var(--success-green)',
                                                            border: 'none',
                                                            borderRadius: 'var(--radius-small)',
                                                            color: 'var(--white)',
                                                            fontSize: '0.75rem',
                                                            fontWeight: 500,
                                                            cursor: selectedDriver ? 'pointer' : 'not-allowed',
                                                            opacity: selectedDriver ? 1 : 0.5,
                                                        }}
                                                    >
                                                        Save
                                                    </button>
                                                    <button
                                                        onClick={() => { setAssigning(null); setSelectedDriver(''); }}
                                                        style={{
                                                            padding: '4px 8px',
                                                            background: 'var(--light-gray)',
                                                            border: '1px solid var(--medium-gray)',
                                                            borderRadius: 'var(--radius-small)',
                                                            color: 'var(--dark-gray)',
                                                            fontSize: '0.75rem',
                                                            cursor: 'pointer',
                                                        }}
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => setAssigning(payment.id)}
                                                    style={{
                                                        padding: '4px 12px',
                                                        background: 'var(--primary-blue)',
                                                        border: 'none',
                                                        borderRadius: 'var(--radius-small)',
                                                        color: 'var(--white)',
                                                        fontSize: '0.75rem',
                                                        fontWeight: 500,
                                                        cursor: 'pointer',
                                                    }}
                                                >
                                                    Assign to Driver
                                                </button>
                                            )}
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
