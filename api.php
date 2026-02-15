<?php
header('Content-Type: application/json');
require_once 'db_config.php';

$action = $_GET['action'] ?? '';

try {
    switch ($action) {
        case 'get_all':
            $clients = $pdo->query("SELECT * FROM clients ORDER BY createdAt DESC")->fetchAll();
            $projects = $pdo->query("SELECT * FROM projects ORDER BY createdAt DESC")->fetchAll();
            $payments = $pdo->query("SELECT * FROM payments ORDER BY createdAt DESC")->fetchAll();
            echo json_encode(['clients' => $clients, 'projects' => $projects, 'payments' => $payments]);
            break;

        case 'save_client':
            $data = json_decode(file_get_contents('php://input'), true);
            if (!$data) throw new Exception('Invalid data');
            
            $stmt = $pdo->prepare("REPLACE INTO clients (id, name, email, phone, company, createdAt) VALUES (?, ?, ?, ?, ?, ?)");
            $stmt->execute([
                $data['id'],
                $data['name'],
                $data['email'] ?? '',
                $data['phone'] ?? '',
                $data['company'] ?? '',
                $data['createdAt'] ?? date('Y-m-d H:i:s')
            ]);
            echo json_encode(['success' => true]);
            break;

        case 'delete_client':
            $id = $_GET['id'] ?? '';
            $stmt = $pdo->prepare("DELETE FROM clients WHERE id = ?");
            $stmt->execute([$id]);
            echo json_encode(['success' => true]);
            break;

        case 'save_project':
            $data = json_decode(file_get_contents('php://input'), true);
            if (!$data) throw new Exception('Invalid data');
            
            $stmt = $pdo->prepare("REPLACE INTO projects (id, clientId, title, description, deadline, status, deliveredAt, amount, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
            $stmt->execute([
                $data['id'],
                $data['clientId'],
                $data['title'],
                $data['description'] ?? '',
                $data['deadline'] ?: null,
                $data['status'] ?? 'in-progress',
                $data['deliveredAt'] ?: null,
                $data['amount'] ?? 0,
                $data['createdAt'] ?? date('Y-m-d H:i:s')
            ]);
            echo json_encode(['success' => true]);
            break;

        case 'delete_project':
            $id = $_GET['id'] ?? '';
            $stmt = $pdo->prepare("DELETE FROM projects WHERE id = ?");
            $stmt->execute([$id]);
            echo json_encode(['success' => true]);
            break;

        case 'save_payment':
            $data = json_decode(file_get_contents('php://input'), true);
            if (!$data) throw new Exception('Invalid data');
            
            $stmt = $pdo->prepare("REPLACE INTO payments (id, projectId, amount, status, dueDate, receivedAt, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)");
            $stmt->execute([
                $data['id'],
                $data['projectId'],
                $data['amount'] ?? 0,
                $data['status'] ?? 'pending',
                $data['dueDate'] ?: null,
                $data['receivedAt'] ?: null,
                $data['createdAt'] ?? date('Y-m-d H:i:s')
            ]);
            echo json_encode(['success' => true]);
            break;

        case 'reset_database':
            $pdo->exec("DELETE FROM payments");
            $pdo->exec("DELETE FROM projects");
            $pdo->exec("DELETE FROM clients");
            echo json_encode(['success' => true]);
            break;

        default:
            throw new Exception('Invalid action');
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
?>
