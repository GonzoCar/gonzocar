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

interface ParserMetrics {
    total: number;
    by_status: Record<string, number>;
    by_category: Record<string, number>;
    by_source: Record<string, number>;
    unparsed_count: number;
    unparsed: Array<{
        id: string;
        gmail_id: string;
        sender: string | null;
        subject: string | null;
        received_at: string | null;
        detected_source: string | null;
        error_message: string | null;
        parser_attempts: number;
    }>;
}

export default function Payments() {
    const [payments, setPayments] = useState<Payment[]>([]);
    const [drivers, setDrivers] = useState<Driver[]>([]);
    const [stats, setStats] = useState<Stats | null>(null);
    const [loading, setLoading] = useState(true);
    const [assigningPaymentId, setAssigningPaymentId] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [inboundEmails, setInboundEmails] = useState<any[]>([]);
    const [parserMetrics, setParserMetrics] = useState<ParserMetrics | null>(null);
    const [reprocessingId, setReprocessingId] = useState<string | null>(null);
    const [reprocessSource, setReprocessSource] = useState<Record<string, string>>({});
    const [originalEmail, setOriginalEmail] = useState<{ id: string; subject: string | null; raw_email: string } | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    async function loadData() {
        try {
            // Do not let the optional inbox archive failure blank the Payments screen.
            // Payments are the source-of-truth data and must render independently.
            const [paymentsResult, driversResult, statsResult, inboundResult, metricsResult] = await Promise.allSettled([
                api.getAllPayments(0, 2000),
                api.getDrivers(),
                api.getPaymentStats(),
                api.getInboundEmails(),
                api.getInboundEmailMetrics(),
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
            if (metricsResult.status === 'fulfilled') {
                setParserMetrics(metricsResult.value as ParserMetrics);
            } else {
                console.error('Failed to load parser metrics:', metricsResult.reason);
            }
        } catch (error) {
            console.error('Failed to load data:', error);
        } finally {
            setLoading(false);
        }
    }

    async function handleViewOriginal(id: string) {
        try {
            const result = await api.getInboundEmail(id);
            setOriginalEmail({ id: result.id, subject: result.subject, raw_email: result.raw_email });
        } catch (error) {
            console.error('Failed to load original email:', error);
        }
    }

    async function handleReprocess(id: string) {
        try {
            setReprocessingId(id);
            await api.reprocessInboundEmail(id, reprocessSource[id] || null);
            await loadData();
        } catch (error) {
            console.error('Failed to reprocess inbound email:', error);
        } finally {
            setReprocessingId(null);
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


            <div style={{ marginBottom: 'var(--space-4)', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-2)' }}>
                {[
                    ['Fetched', parserMetrics ? Object.values(parserMetrics.by_status || {}).reduce((a, b) => a + b, 0) : 0],
                    ['Parsed', parserMetrics?.by_status?.parsed || 0],
                    ['Unparsed', parserMetrics?.by_status?.unparsed || 0],
                    ['Ignored', parserMetrics?.by_status?.ignored || 0],
                ].map(([label, value]) => (
                    <div key={String(label)} style={{ padding: '12px', border: '1px solid var(--light-gray)', borderRadius: '10px', background: 'var(--white)' }}>
                        <div style={{ fontSize: '0.72rem', opacity: 0.65, textTransform: 'uppercase' }}>{label}</div>
                        <div style={{ fontSize: '1.3rem', fontWeight: 700, marginTop: '3px' }}>{value}</div>
                    </div>
                ))}
            </div>

            {parserMetrics && parserMetrics.unparsed.length > 0 && (
                <div style={{ marginBottom: 'var(--space-4)', background: 'var(--white)', borderRadius: 'var(--radius-standard)', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)', overflow: 'hidden' }}>
                    <div style={{ padding: 'var(--space-3)', borderBottom: '1px solid var(--light-gray)' }}>
                        <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem', color: 'var(--dark-gray)' }}>Unparsed Payment Inbox ({parserMetrics.unparsed_count})</h3>
                        <div style={{ color: 'var(--dark-gray)', opacity: 0.7, fontSize: '0.8rem' }}>Review payment-like emails that did not match a parser. Choose a source to retry with that parser.</div>
                    </div>
                    <div style={{ maxHeight: '420px', overflow: 'auto' }}>
                        {parserMetrics.unparsed.map((mail) => (
                            <div key={mail.id} style={{ padding: '12px', borderTop: '1px solid var(--light-gray)', display: 'grid', gridTemplateColumns: '1fr auto', gap: '12px', alignItems: 'center' }}>
                                <div style={{ minWidth: 0 }}>
                                    <div style={{ fontWeight: 700, color: 'var(--dark-gray)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{mail.subject || 'No subject'}</div>
                                    <div style={{ fontSize: '0.78rem', opacity: 0.72, marginTop: '3px' }}>{mail.sender || 'Unknown sender'}{mail.detected_source ? ' • detected ' + mail.detected_source : ''} • attempts {mail.parser_attempts}</div>
                                    <div style={{ fontSize: '0.75rem', color: '#A42C36', marginTop: '3px' }}>{mail.error_message || 'No parser match'}</div>
                                </div>
                                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                    <select value={reprocessSource[mail.id] || ''} onChange={(e) => setReprocessSource((current) => ({ ...current, [mail.id]: e.target.value }))} style={{ padding: '6px 8px', border: '1px solid var(--medium-gray)', borderRadius: '6px' }}>
                                        <option value="">Auto detect</option>
                                        <option value="zelle">Zelle</option>
                                        <option value="cashapp">Cash App</option>
                                        <option value="venmo">Venmo</option>
                                        <option value="chime">Chime</option>
                                        <option value="stripe">Stripe</option>
                                    </select>
                                    <button type="button" onClick={() => handleViewOriginal(mail.id)} style={{ padding: '6px 10px', border: '1px solid var(--medium-gray)', borderRadius: '6px', background: 'white', color: 'var(--dark-gray)', fontWeight: 700, cursor: 'pointer' }}>
                                        Original
                                    </button>
                                    <button type="button" onClick={() => handleReprocess(mail.id)} disabled={reprocessingId === mail.id} style={{ padding: '6px 10px', border: 0, borderRadius: '6px', background: 'var(--primary-blue)', color: 'white', fontWeight: 700, cursor: 'pointer' }}>
                                        {reprocessingId === mail.id ? 'Retrying...' : 'Reprocess'}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

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
        {originalEmail && (
            <div onClick={() => setOriginalEmail(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
                <div onClick={(event) => event.stopPropagation()} style={{ width: 'min(1100px, 96vw)', height: 'min(760px, 90vh)', background: 'white', borderRadius: '14px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--light-gray)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <strong>Original email: {originalEmail.subject || 'No subject'}</strong>
                        <button type="button" onClick={() => setOriginalEmail(null)} style={{ border: 0, background: 'transparent', fontSize: '1.2rem', cursor: 'pointer' }}>×</button>
                    </div>
                    <pre style={{ margin: 0, padding: '16px', overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: '0.72rem', lineHeight: 1.45, flex: 1 }}>{originalEmail.raw_email}</pre>
                </div>
            </div>
        )}

        </div>
    );
}
