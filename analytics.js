// Analytics and Dashboard Calculations

class Analytics {
    constructor(dataManager) {
        this.dm = dataManager;
    }

    // Get dashboard statistics
    getDashboardStats() {
        return {
            pendingWork: this.getPendingWorkCount(),
            pendingPayments: this.getPendingPaymentsCount(),
            remindersNeeded: this.getRemindersNeededCount(),
            monthlyTotal: this.getMonthlyPaymentTotal(),
            pendingNextWeek: this.getPendingAmountNextWeek(),
            totalPending: this.getTotalPendingAmount()
        };
    }

    // Count projects with pending or in-progress status
    getPendingWorkCount() {
        return this.dm.projects.filter(p =>
            p.status === 'pending' || p.status === 'in-progress'
        ).length;
    }

    // Count payments with pending status
    getPendingPaymentsCount() {
        return this.dm.payments.filter(p => p.status === 'pending').length;
    }

    // Count payments that need reminders (6+ days pending)
    getRemindersNeededCount() {
        const reminders = this.getPaymentsNeedingReminders();
        return reminders.length;
    }

    // Calculate total payments received in current month
    getMonthlyPaymentTotal() {
        const { start, end } = getCurrentMonthRange();
        const monthlyPayments = this.dm.payments.filter(p => {
            if (p.status !== 'received' || !p.receivedAt) return false;
            const receivedDate = new Date(p.receivedAt);
            return receivedDate >= start && receivedDate <= end;
        });

        return monthlyPayments.reduce((total, p) => total + p.amount, 0);
    }

    // Get total pending amount for the next 7 days
    getPendingAmountNextWeek() {
        const now = new Date();
        const sevenDaysFromNow = new Date();
        sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

        return this.dm.payments
            .filter(p => p.status === 'pending' && new Date(p.dueDate) >= now && new Date(p.dueDate) <= sevenDaysFromNow)
            .reduce((total, p) => total + p.amount, 0);
    }

    // Get total pending amount for all time
    getTotalPendingAmount() {
        return this.dm.payments
            .filter(p => p.status === 'pending')
            .reduce((total, p) => total + p.amount, 0);
    }

    // Get payments that need reminders (pending for 6+ days)
    getPaymentsNeedingReminders() {
        const now = new Date();
        const pendingPayments = this.dm.payments.filter(p => p.status === 'pending');

        return pendingPayments.filter(payment => {
            const daysPending = daysSince(payment.createdAt);
            return daysPending >= 6;
        }).map(payment => {
            const project = this.dm.getProject(payment.projectId);
            const client = project ? this.dm.getClient(project.clientId) : null;
            return {
                ...payment,
                project,
                client,
                daysPending: daysSince(payment.createdAt),
                daysOverdue: Math.max(0, daysSince(payment.createdAt) - 6)
            };
        }).sort((a, b) => b.daysPending - a.daysPending); // Sort by most overdue first
    }

    // Get overdue projects
    getOverdueProjects() {
        const now = new Date();
        return this.dm.projects.filter(p => {
            if (p.status === 'delivered') return false;
            return isOverdue(p.deadline);
        }).map(project => ({
            ...project,
            client: this.dm.getClient(project.clientId),
            daysOverdue: Math.abs(daysUntil(project.deadline))
        })).sort((a, b) => b.daysOverdue - a.daysOverdue);
    }

    // Get upcoming deadlines (next 7 days)
    getUpcomingDeadlines() {
        const now = new Date();
        const sevenDaysFromNow = new Date();
        sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

        return this.dm.projects.filter(p => {
            if (p.status === 'delivered') return false;
            const deadline = new Date(p.deadline);
            return deadline >= now && deadline <= sevenDaysFromNow;
        }).map(project => ({
            ...project,
            client: this.dm.getClient(project.clientId),
            daysUntil: daysUntil(project.deadline)
        })).sort((a, b) => a.daysUntil - b.daysUntil);
    }

    // Get client statistics
    getClientStats(clientId) {
        const projects = this.dm.getProjectsByClient(clientId);
        const payments = [];

        projects.forEach(project => {
            const projectPayments = this.dm.getPaymentsByProject(project.id);
            payments.push(...projectPayments);
        });

        return {
            totalProjects: projects.length,
            activeProjects: projects.filter(p => p.status !== 'delivered').length,
            completedProjects: projects.filter(p => p.status === 'delivered').length,
            totalRevenue: payments.reduce((sum, p) => sum + p.amount, 0),
            receivedRevenue: payments.filter(p => p.status === 'received').reduce((sum, p) => sum + p.amount, 0),
            pendingRevenue: payments.filter(p => p.status === 'pending').reduce((sum, p) => sum + p.amount, 0),
            overduePayments: payments.filter(p => p.status === 'pending' && daysSince(p.createdAt) >= 6).length
        };
    }

    // Get all clients with their stats
    getClientsWithStats() {
        return this.dm.clients.map(client => ({
            ...client,
            stats: this.getClientStats(client.id)
        }));
    }

    // Get monthly revenue trend (last 6 months)
    getMonthlyRevenueTrend() {
        const months = [];
        const now = new Date();

        for (let i = 2; i >= 0; i--) {
            const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
            const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59);

            const monthlyPayments = this.dm.payments.filter(p => {
                if (p.status !== 'received' || !p.receivedAt) return false;
                const receivedDate = new Date(p.receivedAt);
                return receivedDate >= monthStart && receivedDate <= monthEnd;
            });

            months.push({
                month: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
                total: monthlyPayments.reduce((sum, p) => sum + p.amount, 0),
                count: monthlyPayments.length
            });
        }

        return months;
    }

    // Get project status distribution
    getProjectStatusDistribution() {
        const statuses = {
            pending: 0,
            'in-progress': 0,
            delivered: 0
        };

        this.dm.projects.forEach(p => {
            if (statuses.hasOwnProperty(p.status)) {
                statuses[p.status]++;
            }
        });

        return statuses;
    }

    // Get payment status distribution
    getPaymentStatusDistribution() {
        const statuses = {
            pending: 0,
            received: 0
        };

        this.dm.payments.forEach(p => {
            if (statuses.hasOwnProperty(p.status)) {
                statuses[p.status]++;
            }
        });

        return statuses;
    }

    // Get top clients by revenue
    getTopClientsByRevenue(limit = 5) {
        const clientsWithStats = this.getClientsWithStats();
        return clientsWithStats
            .sort((a, b) => b.stats.totalRevenue - a.stats.totalRevenue)
            .slice(0, limit);
    }

    // Search across all entities
    search(query) {
        const term = query.toLowerCase();

        const clients = this.dm.clients.filter(c =>
            c.name.toLowerCase().includes(term) ||
            c.email.toLowerCase().includes(term) ||
            (c.company && c.company.toLowerCase().includes(term))
        );

        const projects = this.dm.projects.filter(p =>
            p.title.toLowerCase().includes(term) ||
            (p.description && p.description.toLowerCase().includes(term))
        );

        return {
            clients,
            projects,
            total: clients.length + projects.length
        };
    }
}

// Create global instance
let analytics;
