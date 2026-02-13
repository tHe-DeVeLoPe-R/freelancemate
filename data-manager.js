// Data Manager - JSON-based database operations
class DataManager {
  constructor() {
    this.clients = [];
    this.projects = [];
    this.payments = [];
    this.initialized = false;
    this.dirHandle = null;
  }

  // Initialize data
  async init() {
    try {
      // First try to load from localStorage for quick start
      const hasLocalStorage = this.loadFromLocalStorage();
      if (hasLocalStorage) {
        console.log('Data loaded from localStorage');
      }
      this.initialized = true;
    } catch (error) {
      console.error('Error initializing data:', error);
      this.initialized = true;
    }
  }

  // Connect to the local data directory
  async connectToFolder() {
    try {
      this.dirHandle = await window.showDirectoryPicker({
        mode: 'readwrite'
      });

      const btn = document.getElementById('connect-folder-btn');
      if (btn) {
        btn.innerHTML = '✅ Folder Connected';
        btn.classList.replace('btn-primary', 'btn-success');
      }

      showToast('Successfully connected to data folder!', 'success');

      // Load data from the folder
      await this.loadFromFolder();

      // Trigger app re-render
      if (typeof app !== 'undefined' && app.render) {
        app.render();
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Error connecting to folder:', error);
        showToast('Failed to connect to folder', 'error');
      }
    }
  }

  // Load data from JSON files in the connected folder
  async loadFromFolder() {
    if (!this.dirHandle) return;

    try {
      const clientsData = await this.readJsonFile('clients.json');
      const projectsData = await this.readJsonFile('projects.json');
      const paymentsData = await this.readJsonFile('payments.json');

      this.clients = clientsData || [];
      this.projects = projectsData || [];
      this.payments = paymentsData || [];

      // Sync to localStorage as well
      this.syncLocalStorage();
      console.log('Data loaded from JSON files in connected folder');
    } catch (error) {
      console.error('Error loading from folder:', error);
      showToast('Error reading JSON files', 'error');
    }
  }

  // Helper to read a JSON file from the handle
  async readJsonFile(filename) {
    try {
      const fileHandle = await this.dirHandle.getFileHandle(filename, { create: true });
      const file = await fileHandle.getFile();
      const text = await file.text();
      return text ? JSON.parse(text) : [];
    } catch (error) {
      console.error(`Error reading ${filename}:`, error);
      return [];
    }
  }

  // Save data to disk (and localStorage)
  async saveData() {
    // Always save to localStorage immediately
    this.syncLocalStorage();

    // If folder is connected, save to JSON files too
    if (this.dirHandle) {
      try {
        await this.writeJsonFile('clients.json', this.clients);
        await this.writeJsonFile('projects.json', this.projects);
        await this.writeJsonFile('payments.json', this.payments);
        console.log('Data saved to JSON files on disk');
      } catch (error) {
        console.error('Error saving to JSON files:', error);
        showToast('Error saving to local files', 'error');
      }
    } else {
      console.log('Data saved to localStorage (Folder not connected)');
    }
  }

  // Helper to write a JSON file to the handle
  async writeJsonFile(filename, data) {
    try {
      const fileHandle = await this.dirHandle.getFileHandle(filename, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(JSON.stringify(data, null, 2));
      await writable.close();
    } catch (error) {
      console.error(`Error writing ${filename}:`, error);
      throw error;
    }
  }

  // Sync current memory state to localStorage
  syncLocalStorage() {
    try {
      localStorage.setItem('clients', JSON.stringify(this.clients));
      localStorage.setItem('projects', JSON.stringify(this.projects));
      localStorage.setItem('payments', JSON.stringify(this.payments));
    } catch (error) {
      console.error('Error syncing to localStorage:', error);
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
    await this.saveData();
  }

  // Load data from localStorage
  loadFromLocalStorage() {
    try {
      const clients = localStorage.getItem('clients');
      const projects = localStorage.getItem('projects');
      const payments = localStorage.getItem('payments');

      if (!clients && !projects && !payments) return false;

      this.clients = clients ? JSON.parse(clients) : [];
      this.projects = projects ? JSON.parse(projects) : [];
      this.payments = payments ? JSON.parse(payments) : [];
      return true;
    } catch (error) {
      console.error('Error loading from localStorage:', error);
      this.clients = [];
      this.projects = [];
      this.payments = [];
      return false;
    }
  }

  // ===== CLIENT OPERATIONS =====

  async addClient(clientData) {
    const client = {
      id: this.generateId(),
      name: clientData.name,
      email: clientData.email,
      phone: clientData.phone,
      company: clientData.company || '',
      createdAt: new Date().toISOString()
    };
    this.clients.push(client);
    await this.saveData();
    return client;
  }

  async updateClient(id, clientData) {
    const index = this.clients.findIndex(c => c.id === id);
    if (index !== -1) {
      this.clients[index] = {
        ...this.clients[index],
        ...clientData,
        id: this.clients[index].id,
        createdAt: this.clients[index].createdAt
      };
      await this.saveData();
      return this.clients[index];
    }
    return null;
  }

  async deleteClient(id) {
    // Also delete associated projects and payments
    const projectIds = this.projects.filter(p => p.clientId === id).map(p => p.id);
    for (const projectId of projectIds) {
      await this.deleteProject(projectId);
    }

    this.clients = this.clients.filter(c => c.id !== id);
    await this.saveData();
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
      clientId: projectData.clientId,
      title: projectData.title,
      description: projectData.description || '',
      deadline: projectData.deadline,
      status: projectData.status || 'pending',
      deliveredAt: null,
      amount: parseFloat(projectData.amount) || 0,
      createdAt: new Date().toISOString()
    };
    this.projects.push(project);

    // Auto-create payment record
    if (project.amount > 0) {
      await this.addPayment({
        projectId: project.id,
        amount: project.amount,
        status: 'pending',
        dueDate: this.calculatePaymentDueDate(project.deadline)
      });
    }

    await this.saveData();
    return project;
  }

  async updateProject(id, projectData) {
    const index = this.projects.findIndex(p => p.id === id);
    if (index !== -1) {
      const oldProject = this.projects[index];
      this.projects[index] = {
        ...oldProject,
        ...projectData,
        id: oldProject.id,
        createdAt: oldProject.createdAt
      };

      // Update deliveredAt if status changed to delivered
      if (projectData.status === 'delivered' && oldProject.status !== 'delivered') {
        this.projects[index].deliveredAt = new Date().toISOString();
      }

      await this.saveData();
      return this.projects[index];
    }
    return null;
  }

  async deleteProject(id) {
    // Also delete associated payments
    this.payments = this.payments.filter(p => p.projectId !== id);
    this.projects = this.projects.filter(p => p.id !== id);
    await this.saveData();
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
      projectId: paymentData.projectId,
      amount: parseFloat(paymentData.amount),
      status: paymentData.status || 'pending',
      dueDate: paymentData.dueDate,
      receivedAt: null,
      createdAt: new Date().toISOString()
    };
    this.payments.push(payment);
    await this.saveData();
    return payment;
  }

  async updatePayment(id, paymentData) {
    const index = this.payments.findIndex(p => p.id === id);
    if (index !== -1) {
      const oldPayment = this.payments[index];
      this.payments[index] = {
        ...oldPayment,
        ...paymentData,
        id: oldPayment.id,
        createdAt: oldPayment.createdAt
      };

      // Update receivedAt if status changed to received
      if (paymentData.status === 'received' && oldPayment.status !== 'received') {
        this.payments[index].receivedAt = new Date().toISOString();
      }

      await this.saveData();
      return this.payments[index];
    }
    return null;
  }

  async deletePayment(id) {
    this.payments = this.payments.filter(p => p.id !== id);
    await this.saveData();
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

  getClientWithProjectsAndPayments(clientId) {
    const client = this.getClient(clientId);
    if (!client) return null;

    const projects = this.getProjectsByClient(clientId);
    const projectsWithPayments = projects.map(project => ({
      ...project,
      payments: this.getPaymentsByProject(project.id)
    }));

    return {
      ...client,
      projects: projectsWithPayments
    };
  }

  // ===== UTILITY FUNCTIONS =====

  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  calculatePaymentDueDate(deliveryDeadline) {
    // Add 7 days to delivery deadline for payment due date
    const deadline = new Date(deliveryDeadline);
    deadline.setDate(deadline.getDate() + 7);
    return deadline.toISOString();
  }

  // Export data as JSON file
  exportData() {
    const data = {
      clients: this.clients,
      projects: this.projects,
      payments: this.payments,
      exportedAt: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `freelancer-data-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Import data from JSON file
  importData(jsonData) {
    try {
      const data = JSON.parse(jsonData);
      this.clients = data.clients || [];
      this.projects = data.projects || [];
      this.payments = data.payments || [];
      this.saveData();
      return true;
    } catch (error) {
      console.error('Error importing data:', error);
      return false;
    }
  }
}

// Create global instance
const dataManager = new DataManager();
