// Main Application Logic

class App {
  constructor() {
    this.currentTab = 'clients';
    this.editingClientId = null;
    this.editingProjectId = null;
  }

  async init() {
    // Load data from localStorage first
    dataManager.loadFromLocalStorage();
    analytics = new Analytics(dataManager);

    // Render initial view
    this.render();

    console.log('App initialized successfully');
  }

  render() {
    this.updateDashboard();
    this.renderClients();
    this.renderProjects();
    this.renderPayments();
    this.renderReminders();
  }

  updateDashboard() {
    const stats = analytics.getDashboardStats();

    document.getElementById('stat-pending-work').textContent = stats.pendingWork;
    document.getElementById('stat-pending-7days').textContent = formatCurrency(stats.pendingNextWeek);
    document.getElementById('stat-total-pending').textContent = formatCurrency(stats.totalPending);
    document.getElementById('stat-monthly-total').textContent = formatCurrency(stats.monthlyTotal);

    this.renderCharts();
  }

  renderCharts() {
    const trend = analytics.getMonthlyRevenueTrend();
    const chartContainer = document.getElementById('revenue-chart');
    if (!chartContainer) return;

    const maxVal = Math.max(...trend.map(m => m.total), 100);

    chartContainer.innerHTML = trend.map(m => {
      const height = (m.total / maxVal) * 100;
      return `
        <div class="chart-bar-wrapper">
          <div class="chart-bar" style="height: ${height}%">
            <span class="chart-tooltip">${formatCurrency(m.total)}</span>
          </div>
          <span class="chart-label">${m.month}</span>
        </div>
      `;
    }).join('');
  }

  // ===== TAB SWITCHING =====

  switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.remove('active');
      if (btn.dataset.tab === tabName) {
        btn.classList.add('active');
      }
    });

    // Update content sections
    document.querySelectorAll('.content-section').forEach(section => {
      section.classList.remove('active');
    });
    document.getElementById(`${tabName}-section`).classList.add('active');

    this.currentTab = tabName;
  }

  // ===== CLIENTS =====

  renderClients() {
    const clients = dataManager.getAllClients();
    const tbody = document.getElementById('clients-table-body');
    const emptyState = document.getElementById('clients-empty');
    const tableContainer = tbody.closest('.table-container');

    if (clients.length === 0) {
      tableContainer.classList.add('hidden');
      emptyState.classList.remove('hidden');
      return;
    }

    tableContainer.classList.remove('hidden');
    emptyState.classList.add('hidden');

    tbody.innerHTML = clients.map(client => {
      const stats = analytics.getClientStats(client.id);
      return `
        <tr>
          <td><strong>${escapeHtml(client.name)}</strong></td>
          <td>${escapeHtml(client.company || '-')}</td>
          <td>${escapeHtml(client.email)}</td>
          <td>${formatPhone(client.phone) || '-'}</td>
          <td>
            <span class="badge badge-in-progress">${stats.totalProjects} total</span>
            ${stats.activeProjects > 0 ? `<span class="badge badge-pending">${stats.activeProjects} active</span>` : ''}
          </td>
          <td>
            <div class="action-buttons">
              <button class="btn btn-sm btn-secondary" onclick="app.editClient('${client.id}')">
                ✏️ Edit
              </button>
              <button class="btn btn-sm btn-danger" onclick="app.deleteClient('${client.id}')">
                🗑️ Delete
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  showAddClientModal() {
    this.editingClientId = null;
    document.getElementById('client-modal-title').textContent = 'Add Client';
    document.getElementById('client-form').reset();
    document.getElementById('client-id').value = '';
    this.openModal('client-modal');
  }

  editClient(clientId) {
    const client = dataManager.getClient(clientId);
    if (!client) return;

    this.editingClientId = clientId;
    document.getElementById('client-modal-title').textContent = 'Edit Client';
    document.getElementById('client-id').value = client.id;
    document.getElementById('client-name').value = client.name;
    document.getElementById('client-email').value = client.email;
    document.getElementById('client-phone').value = client.phone || '';
    document.getElementById('client-company').value = client.company || '';
    this.openModal('client-modal');
  }

  async saveClient(event) {
    event.preventDefault();

    const clientData = {
      name: document.getElementById('client-name').value,
      email: document.getElementById('client-email').value,
      phone: document.getElementById('client-phone').value,
      company: document.getElementById('client-company').value
    };

    const clientId = document.getElementById('client-id').value;

    if (clientId) {
      await dataManager.updateClient(clientId, clientData);
      showToast('Client updated successfully!', 'success');
    } else {
      await dataManager.addClient(clientData);
      showToast('Client added successfully!', 'success');
    }

    this.closeModal('client-modal');
    this.render();
  }

  async deleteClient(clientId) {
    const client = dataManager.getClient(clientId);
    if (!client) return;

    if (window.confirm(`Are you sure you want to delete ${client.name}? This will also delete all associated projects and payments.`)) {
      await dataManager.deleteClient(clientId);
      showToast('Client deleted successfully!', 'success');
      this.render();
    }
  }

  // ===== PROJECTS =====

  renderProjects() {
    const projects = dataManager.getProjectsWithClientInfo();
    const tbody = document.getElementById('projects-table-body');
    const emptyState = document.getElementById('projects-empty');
    const tableContainer = tbody.closest('.table-container');

    if (projects.length === 0) {
      tableContainer.classList.add('hidden');
      emptyState.classList.remove('hidden');
      return;
    }

    tableContainer.classList.remove('hidden');
    emptyState.classList.add('hidden');

    tbody.innerHTML = projects.map(project => {
      const isOverdueFlag = project.status !== 'delivered' && isOverdue(project.deadline);
      const statusBadge = isOverdueFlag ? getStatusBadge('overdue') : getStatusBadge(project.status);

      return `
        <tr>
          <td>
            <strong>${escapeHtml(project.title)}</strong>
            ${project.description ? `<br><small style="color: var(--text-muted)">${escapeHtml(truncate(project.description, 50))}</small>` : ''}
          </td>
          <td>${project.client ? escapeHtml(project.client.name) : 'Unknown'}</td>
          <td>
            ${formatDate(project.deadline)}
            ${isOverdueFlag ? `<br><span class="badge badge-overdue">${Math.abs(daysUntil(project.deadline))} days overdue</span>` : ''}
            ${!isOverdueFlag && project.status !== 'delivered' ? `<br><small style="color: var(--text-muted)">${formatRelativeDate(project.deadline)}</small>` : ''}
          </td>
          <td><strong>${formatCurrency(project.amount)}</strong></td>
          <td>${statusBadge}</td>
          <td>
            <div class="action-buttons">
              <button class="btn btn-sm btn-secondary" onclick="app.editProject('${project.id}')">
                ✏️ Edit
              </button>
              <button class="btn btn-sm btn-danger" onclick="app.deleteProject('${project.id}')">
                🗑️ Delete
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  showAddProjectModal() {
    this.editingProjectId = null;
    document.getElementById('project-modal-title').textContent = 'Add Project';
    document.getElementById('project-form').reset();
    document.getElementById('project-id').value = '';

    // Populate client dropdown
    this.populateClientDropdown();

    this.openModal('project-modal');
  }

  editProject(projectId) {
    const project = dataManager.getProject(projectId);
    if (!project) return;

    this.editingProjectId = projectId;
    document.getElementById('project-modal-title').textContent = 'Edit Project';
    document.getElementById('project-id').value = project.id;
    document.getElementById('project-client').value = project.clientId;
    document.getElementById('project-title').value = project.title;
    document.getElementById('project-description').value = project.description || '';
    document.getElementById('project-deadline').value = project.deadline.split('T')[0];
    document.getElementById('project-amount').value = project.amount;
    document.getElementById('project-status').value = project.status;

    this.populateClientDropdown();
    this.openModal('project-modal');
  }

  async saveProject(event) {
    event.preventDefault();

    const projectData = {
      clientId: document.getElementById('project-client').value,
      title: document.getElementById('project-title').value,
      description: document.getElementById('project-description').value,
      deadline: document.getElementById('project-deadline').value,
      amount: document.getElementById('project-amount').value,
      status: document.getElementById('project-status').value
    };

    const projectId = document.getElementById('project-id').value;

    if (projectId) {
      await dataManager.updateProject(projectId, projectData);
      showToast('Project updated successfully!', 'success');
    } else {
      await dataManager.addProject(projectData);
      showToast('Project added successfully!', 'success');
    }

    this.closeModal('project-modal');
    this.render();
  }

  async deleteProject(projectId) {
    const project = dataManager.getProject(projectId);
    if (!project) return;

    if (window.confirm(`Are you sure you want to delete "${project.title}"? This will also delete associated payments.`)) {
      await dataManager.deleteProject(projectId);
      showToast('Project deleted successfully!', 'success');
      this.render();
    }
  }

  populateClientDropdown() {
    const select = document.getElementById('project-client');
    const clients = dataManager.getAllClients();

    select.innerHTML = '<option value="">Select a client</option>' +
      clients.map(client =>
        `<option value="${client.id}">${escapeHtml(client.name)}</option>`
      ).join('');
  }

  // ===== PAYMENTS =====

  renderPayments() {
    const payments = dataManager.getPaymentsWithProjectAndClientInfo();
    const tbody = document.getElementById('payments-table-body');
    const emptyState = document.getElementById('payments-empty');
    const tableContainer = tbody.closest('.table-container');

    if (payments.length === 0) {
      tableContainer.classList.add('hidden');
      emptyState.classList.remove('hidden');
      return;
    }

    tableContainer.classList.remove('hidden');
    emptyState.classList.add('hidden');

    tbody.innerHTML = payments.map(payment => {
      const daysPending = payment.status === 'pending' ? daysSince(payment.createdAt) : 0;
      const needsReminder = daysPending >= 6;

      return `
        <tr>
          <td>
            <strong>${payment.project ? escapeHtml(payment.project.title) : 'Unknown'}</strong>
          </td>
          <td>${payment.client ? escapeHtml(payment.client.name) : 'Unknown'}</td>
          <td><strong>${formatCurrency(payment.amount)}</strong></td>
          <td>
            ${formatDate(payment.dueDate)}
            ${payment.status === 'pending' ? `<br><small style="color: var(--text-muted)">${daysPending} days pending</small>` : ''}
          </td>
          <td>
            ${getStatusBadge(payment.status)}
            ${needsReminder ? '<br><span class="badge badge-overdue">Reminder needed</span>' : ''}
          </td>
          <td>
            <div class="action-buttons">
              ${payment.status === 'pending' ? `
                <button class="btn btn-sm btn-success" onclick="app.markPaymentReceived('${payment.id}')">
                  ✅ Mark Received
                </button>
              ` : `
                <span class="badge badge-received">Received ${formatDate(payment.receivedAt)}</span>
              `}
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  async markPaymentReceived(paymentId) {
    await dataManager.updatePayment(paymentId, { status: 'received' });
    showToast('Payment marked as received!', 'success');
    this.render();
  }

  // ===== REMINDERS =====

  renderReminders() {
    const reminders = analytics.getPaymentsNeedingReminders();
    const tbody = document.getElementById('reminders-table-body');
    const emptyState = document.getElementById('reminders-empty');
    const tableContainer = tbody.closest('.table-container');
    const countBadge = document.getElementById('reminders-count');

    countBadge.textContent = `${reminders.length} reminder${reminders.length !== 1 ? 's' : ''}`;

    if (reminders.length === 0) {
      tableContainer.classList.add('hidden');
      emptyState.classList.remove('hidden');
      return;
    }

    tableContainer.classList.remove('hidden');
    emptyState.classList.add('hidden');

    tbody.innerHTML = reminders.map(reminder => {
      return `
        <tr>
          <td>
            <strong>${reminder.client ? escapeHtml(reminder.client.name) : 'Unknown'}</strong>
            ${reminder.client && reminder.client.email ? `<br><small style="color: var(--text-muted)">${escapeHtml(reminder.client.email)}</small>` : ''}
          </td>
          <td>${reminder.project ? escapeHtml(reminder.project.title) : 'Unknown'}</td>
          <td><strong>${formatCurrency(reminder.amount)}</strong></td>
          <td>
            <span class="badge badge-warning">${reminder.daysPending} days</span>
          </td>
          <td>
            <span class="badge badge-overdue">${reminder.daysOverdue} days</span>
          </td>
          <td>
            <div class="action-buttons">
              <button class="btn btn-sm btn-success" onclick="app.markPaymentReceived('${reminder.id}')">
                ✅ Mark Received
              </button>
              ${reminder.client && reminder.client.email ? `
                <button class="btn btn-sm btn-secondary" onclick="app.copyReminderEmail('${reminder.client.email}', '${reminder.project ? reminder.project.title : ''}', ${reminder.amount})">
                  📧 Copy Email
                </button>
              ` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  copyReminderEmail(email, projectTitle, amount) {
    const message = `Hi,\n\nThis is a friendly reminder about the pending payment for "${projectTitle}" (${formatCurrency(amount)}).\n\nPlease let me know if you have any questions.\n\nThank you!`;
    copyToClipboard(message);
  }

  // ===== MODAL MANAGEMENT =====

  openModal(modalId) {
    document.getElementById(modalId).classList.add('active');
  }

  closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
  }

  // ===== DATA IMPORT/EXPORT =====

  exportData() {
    dataManager.exportData();
    showToast('Data exported successfully!', 'success');
  }

  async importData(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const jsonData = await readJSONFile(file);
      const jsonString = JSON.stringify(jsonData);

      if (dataManager.importData(jsonString)) {
        showToast('Data imported successfully!', 'success');
        this.render();
      } else {
        showToast('Failed to import data', 'error');
      }
    } catch (error) {
      console.error('Import error:', error);
      showToast('Invalid JSON file', 'error');
    }

    // Reset file input
    event.target.value = '';
  }

  // ===== DATA RESET =====

  async resetDatabase() {
    if (window.confirm('WARNING: This will permanently delete all data from your browser. Continue?')) {
      await dataManager.clearData();
      showToast('Database reset successfully!', 'success');
      this.render();
    }
  }
}

// Initialize app when DOM is ready
window.app = new App();
const app = window.app;
document.addEventListener('DOMContentLoaded', async () => {
  await dataManager.init();
  await app.init();
});
