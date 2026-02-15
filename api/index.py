from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime

app = Flask(__name__)
CORS(app)

# Database connection helper
def get_db_connection():
    # Check all common Vercel/Prisma environment variable names
    url = (os.environ.get('POSTGRES_URL') or 
           os.environ.get('DATABASE_URL') or 
           os.environ.get('STORAGE_URL'))
    if not url:
        raise Exception("Missing database connection URL (POSTGRES_URL, DATABASE_URL, or STORAGE_URL)")
    
    # Psycopg2 requires postgresql:// instead of postgres://
    if url.startswith('postgres://'):
        url = url.replace('postgres://', 'postgresql://', 1)
        
    conn = psycopg2.connect(url, cursor_factory=RealDictCursor)
    return conn

# Initialize database tables
def init_db():
    conn = get_db_connection()
    cur = conn.cursor()
    
    # Create Clients table
    cur.execute('''
        CREATE TABLE IF NOT EXISTS clients (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT,
            phone TEXT,
            company TEXT,
            createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Create Projects table
    cur.execute('''
        CREATE TABLE IF NOT EXISTS projects (
            id TEXT PRIMARY KEY,
            clientId TEXT REFERENCES clients(id) ON DELETE CASCADE,
            title TEXT NOT NULL,
            description TEXT,
            deadline TEXT,
            status TEXT DEFAULT 'pending',
            deliveredAt TIMESTAMP,
            amount DECIMAL(12, 2) DEFAULT 0,
            createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Create Payments table
    cur.execute('''
        CREATE TABLE IF NOT EXISTS payments (
            id TEXT PRIMARY KEY,
            projectId TEXT REFERENCES projects(id) ON DELETE CASCADE,
            amount DECIMAL(12, 2) NOT NULL,
            status TEXT DEFAULT 'pending',
            dueDate TEXT,
            receivedAt TIMESTAMP,
            createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    conn.commit()
    cur.close()
    conn.close()

# Initialize DB when the app starts
with app.app_context():
    try:
        init_db()
        print("Database initialized successfully")
    except Exception as e:
        print(f"Database initialization deferred: {e}")

@app.route('/health', methods=['GET'])
@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({"status": "healthy", "timestamp": datetime.now().isoformat()})

# ===== CLIENTS =====
@app.route('/clients', methods=['GET', 'POST'])
@app.route('/api/clients', methods=['GET', 'POST'])
def handle_clients():
    conn = get_db_connection()
    cur = conn.cursor()
    
    if request.method == 'GET':
        cur.execute('SELECT * FROM clients ORDER BY createdAt DESC')
        clients = cur.fetchall()
        cur.close()
        conn.close()
        return jsonify(clients)
    
    if request.method == 'POST':
        data = request.json
        cur.execute(
            'INSERT INTO clients (id, name, email, phone, company) VALUES (%s, %s, %s, %s, %s) RETURNING *',
            (data['id'], data['name'], data.get('email'), data.get('phone'), data.get('company'))
        )
        new_client = cur.fetchone()
        conn.commit()
        cur.close()
        conn.close()
        return jsonify(new_client), 201

@app.route('/clients/<id>', methods=['PUT', 'DELETE'])
@app.route('/api/clients/<id>', methods=['PUT', 'DELETE'])
def handle_client(id):
    conn = get_db_connection()
    cur = conn.cursor()
    
    if request.method == 'PUT':
        data = request.json
        cur.execute(
            'UPDATE clients SET name = %s, email = %s, phone = %s, company = %s WHERE id = %s RETURNING *',
            (data['name'], data.get('email'), data.get('phone'), data.get('company'), id)
        )
        updated_client = cur.fetchone()
        conn.commit()
        cur.close()
        conn.close()
        return jsonify(updated_client)
    
    if request.method == 'DELETE':
        cur.execute('DELETE FROM clients WHERE id = %s', (id,))
        conn.commit()
        cur.close()
        conn.close()
        return '', 204

# ===== PROJECTS =====
@app.route('/projects', methods=['GET', 'POST'])
@app.route('/api/projects', methods=['GET', 'POST'])
def handle_projects():
    conn = get_db_connection()
    cur = conn.cursor()
    
    if request.method == 'GET':
        cur.execute('SELECT * FROM projects ORDER BY createdAt DESC')
        projects = cur.fetchall()
        cur.close()
        conn.close()
        return jsonify(projects)
    
    if request.method == 'POST':
        data = request.json
        cur.execute(
            'INSERT INTO projects (id, clientId, title, description, deadline, status, amount) VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING *',
            (data['id'], data['clientId'], data['title'], data.get('description'), data['deadline'], data.get('status', 'pending'), data.get('amount', 0))
        )
        new_project = cur.fetchone()
        conn.commit()
        cur.close()
        conn.close()
        return jsonify(new_project), 201

@app.route('/projects/<id>', methods=['PUT', 'DELETE'])
@app.route('/api/projects/<id>', methods=['PUT', 'DELETE'])
def handle_project(id):
    conn = get_db_connection()
    cur = conn.cursor()
    
    if request.method == 'PUT':
        data = request.json
        cur.execute(
            'UPDATE projects SET title = %s, description = %s, deadline = %s, status = %s, amount = %s, deliveredAt = %s WHERE id = %s RETURNING *',
            (data['title'], data.get('description'), data['deadline'], data['status'], data['amount'], data.get('deliveredAt'), id)
        )
        updated_project = cur.fetchone()
        conn.commit()
        cur.close()
        conn.close()
        return jsonify(updated_project)
    
    if request.method == 'DELETE':
        cur.execute('DELETE FROM projects WHERE id = %s', (id,))
        conn.commit()
        cur.close()
        conn.close()
        return '', 204

# ===== PAYMENTS =====
@app.route('/payments', methods=['GET', 'POST'])
@app.route('/api/payments', methods=['GET', 'POST'])
def handle_payments():
    conn = get_db_connection()
    cur = conn.cursor()
    
    if request.method == 'GET':
        cur.execute('SELECT * FROM payments ORDER BY createdAt DESC')
        payments = cur.fetchall()
        cur.close()
        conn.close()
        return jsonify(payments)
    
    if request.method == 'POST':
        data = request.json
        cur.execute(
            'INSERT INTO payments (id, projectId, amount, status, dueDate) VALUES (%s, %s, %s, %s, %s) RETURNING *',
            (data['id'], data['projectId'], data['amount'], data.get('status', 'pending'), data['dueDate'])
        )
        new_payment = cur.fetchone()
        conn.commit()
        cur.close()
        conn.close()
        return jsonify(new_payment), 201

@app.route('/payments/<id>', methods=['PUT', 'DELETE'])
@app.route('/api/payments/<id>', methods=['PUT', 'DELETE'])
def handle_payment(id):
    conn = get_db_connection()
    cur = conn.cursor()
    
    if request.method == 'PUT':
        data = request.json
        cur.execute(
            'UPDATE payments SET status = %s, receivedAt = %s WHERE id = %s RETURNING *',
            (data['status'], data.get('receivedAt'), id)
        )
        updated_payment = cur.fetchone()
        conn.commit()
        cur.close()
        conn.close()
        return jsonify(updated_payment)
    
    if request.method == 'DELETE':
        cur.execute('DELETE FROM payments WHERE id = %s', (id,))
        conn.commit()
        cur.close()
        conn.close()
        return '', 204

# Vercel entry point
if __name__ == '__main__':
    app.run(debug=True)
