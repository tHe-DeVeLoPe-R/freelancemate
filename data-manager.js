// Data Manager - Hybrid Persistence (API with LocalStorage Fallback)
class DataManager {
  constructor() {
    this.clients = [];
    this.projects = [];
    this.payments = [];
    this.initialized = false;
    this.apiBase = '/api';
    this.useApi = false; // Will be set to true if health check passes
  }

  // Initialize data
  async init() {
    const statusBadge = document.getElementById('api-status');
    if (statusBadge) {
      statusBadge.textContent = '🔍 Checking Sync...';
      statusBadge.className = 'badge badge-pending';
    }

    try {
      // Check if API is available
      const healthCheck = await fetch(`${this.apiBase}/health`).catch(() => ({ ok: false }));
      if (healthCheck.ok) {
        this.useApi = true;
        await this.reloadAllData();
        if (statusBadge) {
          statusBadge.textContent = '✅ Cloud Sync On';
          statusBadge.className = 'badge badge-success';
        }
      } else {
        throw new Error('API unreachable');
      }
    } catch (error) {
      console.log('Using Local Storage (Cloud Sync Offline)');
      this.useApi = false;
      this.loadFromLocalStorage();
      if (statusBadge) {
        statusBadge.textContent = '🏠 Local Mode';
        statusBadge.className = 'badge badge-secondary';
        statusBadge.title = 'Data is saved on this device only. Set up Vercel Postgres to enable cloud sync.';
      }
    }

    this.initialized = true;
  }

  async reloadAllData() {
    try {
      const [clients, projects, payments] = await Promise.all([
        fetch(`${this.apiBase}/clients`).then(res => res.json()),
        fetch(`${this.apiBase}/projects`).then(res => res.json()),
        fetch(`${this.apiBase}/payments`).then(res => res.json())
      ]);

      this.clients = clients;
      this.projects = projects;
      this.payments = payments;
      this.syncLocalStorage();
    } catch (e) {
      console.warn('Reloading failed, keeping local data', e);
    }
  }

  // ===== CLIENT OPERATIONS =====

  async addClient(clientData) {
    const client = {
      id: this.generateId(),
      ...clientData,
      createdAt: new Date().toISOString()
    };

    // Always update local first for responsiveness
    this.clients.unshift(client);
    this.syncLocalStorage();

    if (this.useApi) {
      try {
        await fetch(`${this.apiBase}/clients`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(client)
        });
      } catch (e) {
        console.error('Failed to sync to cloud', e);
      }
    }

    return client;
  }

  async updateClient(id, clientData) {
    const index = this.clients.findIndex(c => c.id === id);
    if (index !== -1) {
      this.clients[index] = { ...this.clients[index], ...clientData };
      this.syncLocalStorage();
    }

    if (this.useApi) {
      try {
        await fetch(`${this.apiBase}/clients/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(clientData)
        });
      } catch (e) {
        console.error('Failed to sync to cloud', e);
      }
    }
    return this.getClient(id);
  }

  async deleteClient(id) {
    // Update local state immediately
    this.clients = this.clients.filter(c => c.id !== id);
    this.projects = this.projects.filter(p => p.clientId !== id);
    const remainingProjectIds = this.projects.map(p => p.id);
    this.payments = this.payments.filter(p => remainingProjectIds.includes(p.projectId));
    this.syncLocalStorage();

    if (this.useApi) {
      try {
        await fetch(`${this.apiBase}/clients/${id}`, { method: 'DELETE' });
      } catch (e) {
        console.error('Failed to sync deletion to cloud', e);
      }
    }
  }

  getClient(id) {
    return this.clients.find(c => c.id === id);
  }

  getAllClients() {
    return this.clients;
  }

  // ===== PROJECT OPERATIONS =====

  async addProject(projectData) {
    const project = {
      id: this.generateId(),
      ...projectData,
      createdAt: new Date().toISOString()
    };

    this.projects.unshift(project);

    // Auto-create payment
    if (project.amount > 0) {
      await this.addPayment({
        projectId: project.id,
        amount: project.amount,
        status: 'pending',
        dueDate: this.calculatePaymentDueDate(project.deadline)
      });
    }

    this.syncLocalStorage();

    if (this.useApi) {
      try {
        await fetch(`${this.apiBase}/projects`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(project)
        });
      } catch (e) {
        console.error('Failed to sync project to cloud', e);
      }
    }

    return project;
  }

  async updateProject(id, projectData) {
    const index = this.projects.findIndex(p => p.id === id);
    if (index !== -1) {
      this.projects[index] = { ...this.projects[index], ...projectData };
      this.syncLocalStorage();
    }

    if (this.useApi) {
      try {
        await fetch(`${this.apiBase}/projects/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(projectData)
        });
      } catch (e) {
        console.error('Failed to sync project to cloud', e);
      }
    }
    return this.getProject(id);
  }

  async deleteProject(id) {
    this.projects = this.projects.filter(p => p.id !== id);
    this.payments = this.payments.filter(p => p.projectId !== id);
    this.syncLocalStorage();

    if (this.useApi) {
      try {
        await fetch(`${this.apiBase}/projects/${id}`, { method: 'DELETE' });
      } catch (e) {
        console.error('Failed to sync project deletion to cloud', e);
      }
    }
  }

  getProject(id) {
    return this.projects.find(p => p.id === id);
  }

  getAllProjects() {
    return this.projects;
  }

  getProjectsByClient(clientId) {
    return this.projects.filter(p => p.clientId === clientId);
  }

  // ===== PAYMENT OPERATIONS =====

  async addPayment(paymentData) {
    const payment = {
      id: this.generateId(),
      ...paymentData,
      createdAt: new Date().toISOString()
    };

    this.payments.unshift(payment);
    this.syncLocalStorage();

    if (this.useApi) {
      try {
        await fetch(`${this.apiBase}/payments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payment)
        });
      } catch (e) {
        console.error('Failed to sync payment to cloud', e);
      }
    }

    return payment;
  }

  async updatePayment(id, paymentData) {
    const index = this.payments.findIndex(p => p.id === id);
    if (index !== -1) {
      this.payments[index] = { ...this.payments[index], ...paymentData };
      this.syncLocalStorage();
    }

    if (this.useApi) {
      try {
        await fetch(`${this.apiBase}/payments/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(paymentData)
        });
      } catch (e) {
        console.error('Failed to sync payment to cloud', e);
      }
    }
    return this.getPayment(id);
  }

  async deletePayment(id) {
    this.payments = this.payments.filter(p => p.id !== id);
    this.syncLocalStorage();

    if (this.useApi) {
      try {
        await fetch(`${this.apiBase}/payments/${id}`, { method: 'DELETE' });
      } catch (e) {
        console.error('Failed to sync payment deletion to cloud', e);
      }
    }
  }

  getPayment(id) {
    return this.payments.find(p => p.id === id);
  }

  getAllPayments() {
    return this.payments;
  }

  getPaymentsByProject(projectId) {
    return this.payments.filter(p => p.projectId === projectId);
  }

  // ===== RELATIONAL QUERIES =====

  getProjectsWithClientInfo() {
    return this.projects.map(project => ({
      ...project,
      client: this.getClient(project.clientId)
    }));
  }

  getPaymentsWithProjectAndClientInfo() {
    return this.payments.map(payment => {
      const project = this.getProject(payment.projectId);
      const client = project ? this.getClient(project.clientId) : null;
      return {
        ...payment,
        project,
        client
      };
    });
  }

  // ===== UTILITY FUNCTIONS =====

  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  calculatePaymentDueDate(deliveryDeadline) {
    const deadline = deliveryDeadline ? new Date(deliveryDeadline) : new Date();
    deadline.setDate(deadline.getDate() + 7);
    return deadline.toISOString();
  }

  syncLocalStorage() {
    try {
      localStorage.setItem('clients', JSON.stringify(this.clients));
      localStorage.setItem('projects', JSON.stringify(this.projects));
      localStorage.setItem('payments', JSON.stringify(this.payments));
    } catch (error) {
      console.error('Error syncing to localStorage:', error);
    }
  }

  loadFromLocalStorage() {
    try {
      const clients = localStorage.getItem('clients');
      const projects = localStorage.getItem('projects');
      const payments = localStorage.getItem('payments');
      this.clients = clients ? JSON.parse(clients) : [];
      this.projects = projects ? JSON.parse(projects) : [];
      this.payments = payments ? JSON.parse(payments) : [];
    } catch (e) {
      console.error('Error loading from localStorage', e);
    }
  }

  // Clear all data (Reset)
  async clearData() {
    this.clients = [];
    this.projects = [];
    this.payments = [];
    localStorage.removeItem('clients');
    localStorage.removeItem('projects');
    localStorage.removeItem('payments');

    if (this.useApi) {
      // For safety, we only clear local in this mode to avoid accidental mass deletion
      showToast('Local data cleared. Cloud sync is still active.', 'info');
    }
  }
}

// Create global instance and attach to window early
window.dataManager = new DataManager();
const dataManager = window.dataManager;
