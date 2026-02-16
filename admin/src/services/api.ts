const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

interface LoginCredentials {
    email: string;
    password: string;
}

interface TokenResponse {
    access_token: string;
    token_type: string;
}

class ApiService {
    private token: string | null = null;

    constructor() {
        this.token = localStorage.getItem('token');
    }

    private headers(): HeadersInit {
        const headers: HeadersInit = {
            'Content-Type': 'application/json',
        };
        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }
        return headers;
    }

    setToken(token: string | null) {
        this.token = token;
        if (token) {
            localStorage.setItem('token', token);
        } else {
            localStorage.removeItem('token');
        }
    }

    getToken(): string | null {
        return this.token;
    }

    async login(credentials: LoginCredentials): Promise<TokenResponse> {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(credentials),
        });
        if (!response.ok) throw new Error('Login failed');
        const data = await response.json();
        this.setToken(data.access_token);
        return data;
    }

    logout() {
        this.setToken(null);
    }

    async me() {
        const response = await fetch(`${API_URL}/auth/me`, { headers: this.headers() });
        if (!response.ok) throw new Error('Not authenticated');
        return response.json();
    }

    // Drivers
    async getDrivers() {
        const response = await fetch(`${API_URL}/drivers`, { headers: this.headers() });
        if (!response.ok) throw new Error('Failed to fetch drivers');
        return response.json();
    }

    async getDriver(id: string) {
        const response = await fetch(`${API_URL}/drivers/${id}`, { headers: this.headers() });
        if (!response.ok) throw new Error('Failed to fetch driver');
        return response.json();
    }

    async getDriverLedger(id: string) {
        const response = await fetch(`${API_URL}/drivers/${id}/ledger`, { headers: this.headers() });
        if (!response.ok) throw new Error('Failed to fetch ledger');
        return response.json();
    }

    async getDriverAliases(id: string) {
        const response = await fetch(`${API_URL}/drivers/${id}/aliases`, { headers: this.headers() });
        if (!response.ok) throw new Error('Failed to fetch aliases');
        return response.json();
    }

    async updateDriverBilling(id: string, active: boolean) {
        const response = await fetch(`${API_URL}/drivers/${id}/billing`, {
            method: 'PATCH',
            headers: this.headers(),
            body: JSON.stringify({ billing_active: active }),
        });
        if (!response.ok) throw new Error('Failed to update billing');
        return response.json();
    }

    // Applications
    async getApplications(status?: string) {
        const url = status ? `${API_URL}/applications?status=${status}` : `${API_URL}/applications`;
        const response = await fetch(url, { headers: this.headers() });
        if (!response.ok) throw new Error('Failed to fetch applications');
        return response.json();
    }

    async getApplication(id: string) {
        const response = await fetch(`${API_URL}/applications/${id}`, { headers: this.headers() });
        if (!response.ok) throw new Error('Failed to fetch application');
        return response.json();
    }

    async updateApplicationStatus(id: string, status: string, message?: string) {
        const response = await fetch(`${API_URL}/applications/${id}/status`, {
            method: 'PATCH',
            headers: this.headers(),
            body: JSON.stringify({ status, message }),
        });
        if (!response.ok) throw new Error('Failed to update status');
        return response.json();
    }

    async addComment(applicationId: string, content: string) {
        const response = await fetch(`${API_URL}/applications/${applicationId}/comment`, {
            method: 'POST',
            headers: this.headers(),
            body: JSON.stringify({ content }),
        });
        if (!response.ok) throw new Error('Failed to add comment');
        return response.json();
    }

    // Payments
    async getUnrecognizedPayments() {
        const response = await fetch(`${API_URL}/payments/unrecognized`, { headers: this.headers() });
        if (!response.ok) throw new Error('Failed to fetch payments');
        return response.json();
    }

    async getPaymentStats(period?: string) {
        const url = period ? `${API_URL}/payments/stats?period=${period}` : `${API_URL}/payments/stats`;
        const response = await fetch(url, { headers: this.headers() });
        if (!response.ok) throw new Error('Failed to fetch stats');
        return response.json();
    }

    async assignPayment(paymentId: string, driverId: string, createAlias: boolean = true) {
        const response = await fetch(`${API_URL}/payments/${paymentId}/assign`, {
            method: 'POST',
            headers: this.headers(),
            body: JSON.stringify({ driver_id: driverId, create_alias: createAlias }),
        });
        if (!response.ok) throw new Error('Failed to assign payment');
        return response.json();
    }

    // System Status
    async getSystemStatus() {
        const response = await fetch(`${API_URL}/status`, { headers: this.headers() });
        if (!response.ok) throw new Error('Failed to fetch status');
        return response.json();
    }

    // SMS
    async sendSms(phone: string, message: string) {
        const response = await fetch(`${API_URL}/sms/send`, {
            method: 'POST',
            headers: this.headers(),
            body: JSON.stringify({ phone, message }),
        });
        if (!response.ok) throw new Error('Failed to send SMS');
        return response.json();
    }
}

export const api = new ApiService();
export default api;
