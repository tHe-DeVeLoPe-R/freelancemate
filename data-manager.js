// Data Manager - PHP/MySQL Backend
class DataManager {
  constructor() {
    this.clients = [];
    this.projects = [];
    this.payments = [];
    this.initialized = false;
    this.apiBase = 'api.php';
  }

  // Initialize data
  async init() {
    const statusBadge = document.getElementById('api-status');
    if (statusBadge) {
      statusBadge.textContent = '🔍 Connecting to Database...';
      statusBadge.className = 'badge badge-pending';
    }

    try {
      await this.reloadAllData();
      if (statusBadge) {
        statusBadge.textContent = '✅ Connected (MySQL)';
        statusBadge.className = 'badge badge-success';
      }
    } catch (error) {
      console.error('Database connection failed:', error);
      if (statusBadge) {
        statusBadge.textContent = '❌ Connection Failed';
        statusBadge.className = 'badge badge-danger';
      }
      // Fallback to empty if DB fails
      this.clients = [];
      this.projects = [];
      this.payments = [];
    }

    this.initialized = true;
  }

  async reloadAllData() {
    try {
      const response = await fetch(`${this.apiBase}?action=get_all`);
      if (!response.ok) throw new Error('Failed to fetch data');
      const data = await response.json();

      this.clients = data.clients || [];
      this.projects = data.projects || [];
      this.payments = data.payments || [];

      // Update IDs to match JS-style if necessary (PHP might return numeric strings)
      this.clients.forEach(c => c.id = String(c.id));
      this.projects.forEach(p => p.id = String(p.id));
      this.payments.forEach(p => p.id = String(p.id));

    } catch (e) {
      console.error('Data reload failed', e);
      throw e;
    }
  }

  // ===== CLIENT OPERATIONS =====

  async addClient(clientData) {
    const client = {
      id: this.generateId(),
      ...clientData,
      createdAt: new Date().toISOString()
    };

    try {
      const response = await fetch(`${this.apiBase}?action=save_client`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(client)
      });
      if (!response.ok) throw new Error('Save failed');

      this.clients.unshift(client);
      return client;
    } catch (e) {
      console.error('Failed to save client', e);
      throw e;
    }
  }

  async updateClient(id, clientData) {
    const existing = this.getClient(id);
    const updatedClient = { ...existing, ...clientData };

    try {
      const response = await fetch(`${this.apiBase}?action=save_client`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedClient)
      });
      if (!response.ok) throw new Error('Update failed');

      const index = this.clients.findIndex(c => c.id === id);
      if (index !== -1) this.clients[index] = updatedClient;

      return updatedClient;
    } catch (e) {
      console.error('Failed to update client', e);
      throw e;
    }
  }

  async deleteClient(id) {
    try {
      // Use simple GET for delete action to ensure compatibility with all hosting environments
      const response = await fetch(`${this.apiBase}?action=delete_client&id=${id}`);
      if (!response.ok) throw new Error('Delete failed');

      // Refresh all data from database to ensure local state is perfectly synced
      await this.reloadAllData();
    } catch (e) {
      console.error('Failed to delete client', e);
      throw e;
    }
  }

  getClient(id) {
    return this.clients.find(c => c.id === String(id));
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

    try {
      const response = await fetch(`${this.apiBase}?action=save_project`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(project)
      });
      if (!response.ok) throw new Error('Project save failed');

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

      return project;
    } catch (e) {
      console.error('Failed to add project', e);
      throw e;
    }
  }

  async updateProject(id, projectData) {
    const existing = this.getProject(id);
    const updatedProject = { ...existing, ...projectData };

    try {
      const response = await fetch(`${this.apiBase}?action=save_project`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedProject)
      });
      if (!response.ok) throw new Error('Project update failed');

      const index = this.projects.findIndex(p => p.id === id);
      if (index !== -1) this.projects[index] = updatedProject;

      return updatedProject;
    } catch (e) {
      console.error('Failed to update project', e);
      throw e;
    }
  }

  async deleteProject(id) {
    try {
      const response = await fetch(`${this.apiBase}?action=delete_project&id=${id}`);
      if (!response.ok) throw new Error('Project delete failed');

      await this.reloadAllData();
    } catch (e) {
      console.error('Failed to delete project', e);
      throw e;
    }
  }

  getProject(id) {
    return this.projects.find(p => p.id === String(id));
  }

  getAllProjects() {
    return this.projects;
  }

  getProjectsByClient(clientId) {
    return this.projects.filter(p => p.clientId === String(clientId));
  }

  // ===== PAYMENT OPERATIONS =====

  async addPayment(paymentData) {
    const payment = {
      id: this.generateId(),
      ...paymentData,
      createdAt: new Date().toISOString()
    };

    try {
      const response = await fetch(`${this.apiBase}?action=save_payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payment)
      });
      if (!response.ok) throw new Error('Payment save failed');

      this.payments.unshift(payment);
      return payment;
    } catch (e) {
      console.error('Failed to add payment', e);
      throw e;
    }
  }

  async updatePayment(id, paymentData) {
    const existing = this.getPayment(id);
    const updatedPayment = { ...existing, ...paymentData };

    // Set receivedAt if marking as received and not already set
    if (updatedPayment.status === 'received' && !updatedPayment.receivedAt) {
      updatedPayment.receivedAt = new Date().toISOString();
    }

    try {
      const response = await fetch(`${this.apiBase}?action=save_payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedPayment)
      });
      if (!response.ok) throw new Error('Payment update failed');

      const index = this.payments.findIndex(p => p.id === id);
      if (index !== -1) this.payments[index] = updatedPayment;

      return updatedPayment;
    } catch (e) {
      console.error('Failed to update payment', e);
      throw e;
    }
  }

  getPayment(id) {
    return this.payments.find(p => p.id === String(id));
  }

  getAllPayments() {
    return this.payments;
  }

  getPaymentsByProject(projectId) {
    return this.payments.filter(p => p.projectId === String(projectId));
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

  // Clear all data (Reset MySQL Database)
  // Clear all data (Reset MySQL Database)
  async clearData() {
    try {
      const response = await fetch(`${this.apiBase}?action=reset_database`, { method: 'POST' });
      if (!response.ok) throw new Error('DB Reset failed');

      await this.reloadAllData();
    } catch (e) {
      console.error('Failed to reset database', e);
      throw e;
    }
  }
}

// Create global instance and attach to window early
window.dataManager = new DataManager();
const dataManager = window.dataManager;
