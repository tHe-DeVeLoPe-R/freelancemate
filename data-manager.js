// Data Manager - API-based database operations
class DataManager {
  constructor() {
    this.clients = [];
    this.projects = [];
    this.payments = [];
    this.initialized = false;
    this.apiBase = '/api'; // Vercel API path
  }

  // Initialize data
  async init() {
    const statusBadge = document.getElementById('api-status');
    try {
      if (statusBadge) {
        statusBadge.textContent = '📡 Connecting...';
        statusBadge.className = 'badge badge-pending';
      }

      await this.reloadAllData();
      this.initialized = true;
      console.log('Data loaded from API');

      if (statusBadge) {
        statusBadge.textContent = '✅ Connected';
        statusBadge.className = 'badge badge-success';
      }
    } catch (error) {
      console.error('Error initializing data from API:', error);
      if (statusBadge) {
        statusBadge.textContent = '❌ Offline';
        statusBadge.className = 'badge badge-danger';
      }
      // Fallback to localStorage if API fails
      this.loadFromLocalStorage();
      this.initialized = true;
    }
  }

  async reloadAllData() {
    const [clients, projects, payments] = await Promise.all([
      fetch(`${this.apiBase}/clients`).then(res => res.json()),
      fetch(`${this.apiBase}/projects`).then(res => res.json()),
      fetch(`${this.apiBase}/payments`).then(res => res.json())
    ]);

    this.clients = clients;
    this.projects = projects;
    this.payments = payments;

    // Cache to localStorage for offline/speed
    this.syncLocalStorage();
  }

  // ===== CLIENT OPERATIONS =====

  async addClient(clientData) {
    const client = {
      id: this.generateId(),
      ...clientData
    };

    const response = await fetch(`${this.apiBase}/clients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(client)
    });

    if (!response.ok) throw new Error('Failed to add client');

    const newClient = await response.json();
    this.clients.unshift(newClient);
    this.syncLocalStorage();
    return newClient;
  }

  async updateClient(id, clientData) {
    const response = await fetch(`${this.apiBase}/clients/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(clientData)
    });

    if (!response.ok) throw new Error('Failed to update client');

    const updatedClient = await response.json();
    const index = this.clients.findIndex(c => c.id === id);
    if (index !== -1) {
      this.clients[index] = updatedClient;
    }
    this.syncLocalStorage();
    return updatedClient;
  }

  async deleteClient(id) {
    const response = await fetch(`${this.apiBase}/clients/${id}`, {
      method: 'DELETE'
    });

    if (!response.ok) throw new Error('Failed to delete client');

    this.clients = this.clients.filter(c => c.id !== id);
    // Associated projects and payments are handled by cascade delete in DB
    // But we need to update our local state
    this.projects = this.projects.filter(p => p.clientId !== id);
    const remainingProjectIds = this.projects.map(p => p.id);
    this.payments = this.payments.filter(p => remainingProjectIds.includes(p.projectId));

    this.syncLocalStorage();
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
      ...projectData
    };

    const response = await fetch(`${this.apiBase}/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(project)
    });

    if (!response.ok) throw new Error('Failed to add project');

    const newProject = await response.json();
    this.projects.unshift(newProject);

    // The backend doesn't auto-create payments in this version to keep logic simple,
    // or we can handle it here if we want. Let's handle it here for consistency with original app.
    if (newProject.amount > 0) {
      await this.addPayment({
        projectId: newProject.id,
        amount: newProject.amount,
        status: 'pending',
        dueDate: this.calculatePaymentDueDate(newProject.deadline)
      });
    }

    this.syncLocalStorage();
    return newProject;
  }

  async updateProject(id, projectData) {
    const response = await fetch(`${this.apiBase}/projects/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(projectData)
    });

    if (!response.ok) throw new Error('Failed to update project');

    const updatedProject = await response.json();
    const index = this.projects.findIndex(p => p.id === id);
    if (index !== -1) {
      this.projects[index] = updatedProject;
    }
    this.syncLocalStorage();
    return updatedProject;
  }

  async deleteProject(id) {
    const response = await fetch(`${this.apiBase}/projects/${id}`, {
      method: 'DELETE'
    });

    if (!response.ok) throw new Error('Failed to delete project');

    this.projects = this.projects.filter(p => p.id !== id);
    this.payments = this.payments.filter(p => p.projectId !== id);
    this.syncLocalStorage();
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
      ...paymentData
    };

    const response = await fetch(`${this.apiBase}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payment)
    });

    if (!response.ok) throw new Error('Failed to add payment');

    const newPayment = await response.json();
    this.payments.unshift(newPayment);
    this.syncLocalStorage();
    return newPayment;
  }

  async updatePayment(id, paymentData) {
    const response = await fetch(`${this.apiBase}/payments/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(paymentData)
    });

    if (!response.ok) throw new Error('Failed to update payment');

    const updatedPayment = await response.json();
    const index = this.payments.findIndex(p => p.id === id);
    if (index !== -1) {
      this.payments[index] = updatedPayment;
    }
    this.syncLocalStorage();
    return updatedPayment;
  }

  async deletePayment(id) {
    const response = await fetch(`${this.apiBase}/payments/${id}`, {
      method: 'DELETE'
    });

    if (!response.ok) throw new Error('Failed to delete payment');

    this.payments = this.payments.filter(p => p.id !== id);
    this.syncLocalStorage();
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
    if (!deliveryDeadline) return new Date().toISOString();
    const deadline = new Date(deliveryDeadline);
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
      if (clients) this.clients = JSON.parse(clients);
      if (projects) this.projects = JSON.parse(projects);
      if (payments) this.payments = JSON.parse(payments);
    } catch (e) {
      console.error('Error loading from localStorage', e);
    }
  }
}

// Create global instance and attach to window to fix scoping issues
window.dataManager = new DataManager();
const dataManager = window.dataManager;
