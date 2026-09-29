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
    const [assigningPaymentId, setAssigningPaymentId] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [inboundEmails, setInboundEmails] = useState<any[]>([]);

    useEffect(() => {
        loadData();
    }, []);

    async function loadData() {
        try {
            // Do not let the optional inbox archive failure blank the Payments screen.
            // Payments are the source-of-truth data and must render independently.
            const [paymentsResult, driversResult, statsResult, inboundResult] = await Promise.allSettled([
                api.getAllPayments(0, 2000),
                api.getDrivers(),
                api.getPaymentStats(),
                api.getInboundEmails(),
            ]);
            if (paymentsResult.status === 'fulfilled') {
                setPayments(paymentsResult.value);
            } else {
                console.error('Failed to load payments:', paymentsResult.reason);
            }
            if (driversResult.status === 'fulfilled') {
                setDrivers(driversResult.value);
            } else {
                console.error('Failed to load drivers:', driversResult.reason);
            }
            if (statsResult.status === 'fulfilled') {
                setStats(statsResult.value);
            } else {
                console.error('Failed to load payment stats:', statsResult.reason);
            }
            if (inboundResult.status === 'fulfilled') {
                setInboundEmails(inboundResult.value);
            } else {
                console.error('Failed to load inbound email archive:', inboundResult.reason);
            }
        } catch (error) {
            console.error('Failed to load data:', error);
        } finally {
            setLoading(false);
        }
    }

    async function handleDriverChange(payment: Payment, nextDriverId: string) {
        if (!nextDriverId) return;
        if (payment.driver_id === nextDriverId) return;
        try {
            setAssigningPaymentId(payment.id);
            await api.assignPayment(payment.id, nextDriverId, true);
            await loadData();
        } catch (error) {
            console.error('Failed to assign payment:', error);
        } finally {
            setAssigningPaymentId(null);
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
                    Review all payments and assign unmatched records
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
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center' }}>
                        <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem', color: 'var(--dark-gray)' }}>All Payments</h3>
                        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search sender, amount, memo, driver..." style={{ minWidth: '280px', padding: '8px 10px', border: '1px solid var(--medium-gray)', borderRadius: '6px' }} />
                    </div>
                </div>

                {loading ? (
                    <div style={{ padding: 'var(--space-4)', textAlign: 'center', color: 'var(--dark-gray)' }}>
                        Loading payments...
                    </div>
                ) : payments.length === 0 ? (
                    <div style={{ padding: 'var(--space-4)', textAlign: 'center', color: 'var(--dark-gray)', opacity: 0.6 }}>
                        No payments found.
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
                                <th style={{ padding: 'var(--space-2) var(--space-3)', textAlign: 'left', color: 'var(--dark-gray)', fontWeight: 600, fontSize: '0.75rem' }}>Driver</th>
                            </tr>
                        </thead>
                        <tbody>
                            {payments.filter((payment) => { const q = search.trim().toLowerCase(); if (!q) return true; const driver = payment.driver_id ? drivers.find((d) => d.id === payment.driver_id) : null; return [payment.sender_name, payment.source, payment.memo, payment.amount, driver ? `${driver.first_name} ${driver.last_name}` : ''].some((v) => String(v ?? '').toLowerCase().includes(q)); }).map((payment) => {
                                const sourceStyle = sourceColors[payment.source] || sourceColors.zelle;
                                const assignedDriver = payment.driver_id
                                    ? drivers.find((driver) => driver.id === payment.driver_id) || null
                                    : null;
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
                                            <select
                                                value={payment.driver_id ?? ''}
                                                onChange={(e) => handleDriverChange(payment, e.target.value)}
                                                disabled={assigningPaymentId === payment.id}
                                                style={{
                                                    minWidth: '180px',
                                                    padding: '4px 8px',
                                                    border: '1px solid var(--medium-gray)',
                                                    borderRadius: 'var(--radius-small)',
                                                    color: 'var(--dark-gray)',
                                                    fontSize: '0.75rem',
                                                    background: 'var(--white)',
                                                    opacity: assigningPaymentId === payment.id ? 0.7 : 1,
                                                }}
                                            >
                                                <option value="">---</option>
                                                {payment.driver_id && !assignedDriver && (
                                                    <option value={payment.driver_id}>
                                                        Assigned Driver
                                                    </option>
                                                )}
                                                {drivers.map((driver) => (
                                                    <option key={driver.id} value={driver.id}>
                                                        {driver.first_name} {driver.last_name}
                                                    </option>
                                                ))}
                                            </select>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>
            <div style={{ marginTop: 'var(--space-4)', background: 'var(--white)', borderRadius: 'var(--radius-standard)', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)', overflow: 'hidden' }}>
                <div style={{ padding: 'var(--space-3)', borderBottom: '1px solid var(--light-gray)' }}>
                    <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem', color: 'var(--dark-gray)' }}>Inbound Email Archive</h3>
                    <div style={{ color: 'var(--dark-gray)', opacity: 0.7, fontSize: '0.8rem' }}>Every fetched Gmail message is retained, including unparsed payments and lead emails.</div>
                </div>
                <div style={{ maxHeight: '360px', overflow: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead><tr style={{ background: 'var(--light-gray)' }}>
                            <th style={{ padding: '8px 12px', textAlign: 'left' }}>Category</th>
                            <th style={{ padding: '8px 12px', textAlign: 'left' }}>Status</th>
                            <th style={{ padding: '8px 12px', textAlign: 'left' }}>Sender</th>
                            <th style={{ padding: '8px 12px', textAlign: 'left' }}>Subject</th>
                            <th style={{ padding: '8px 12px', textAlign: 'left' }}>Date</th>
                        </tr></thead>
                        <tbody>{inboundEmails.map((mail) => (
                            <tr key={mail.id} style={{ borderTop: '1px solid var(--light-gray)' }}>
                                <td style={{ padding: '8px 12px', fontWeight: 600 }}>{mail.category}</td>
                                <td style={{ padding: '8px 12px' }}>{mail.parse_status}</td>
                                <td style={{ padding: '8px 12px' }}>{mail.sender || '-'}</td>
                                <td style={{ padding: '8px 12px' }}>{mail.subject || '-'}</td>
                                <td style={{ padding: '8px 12px' }}>{mail.received_at ? new Date(mail.received_at).toLocaleString() : '-'}</td>
                            </tr>
                        ))}</tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
