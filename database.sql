-- Freelancer Manager Database Schema
-- Generated on 2026-02-15

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";

-- --------------------------------------------------------
-- Table structure for table `clients`
-- --------------------------------------------------------

CREATE TABLE `clients` (
  `id` varchar(50) NOT NULL,
  `name` varchar(255) NOT NULL,
  `email` varchar(255) DEFAULT NULL,
  `phone` varchar(50) DEFAULT NULL,
  `company` varchar(255) DEFAULT NULL,
  `createdAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------
-- Table structure for table `projects`
-- --------------------------------------------------------

CREATE TABLE `projects` (
  `id` varchar(50) NOT NULL,
  `clientId` varchar(50) NOT NULL,
  `title` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `deadline` date DEFAULT NULL,
  `status` enum('in-progress','delivered','completed','cancelled') DEFAULT 'in-progress',
  `deliveredAt` datetime DEFAULT NULL,
  `amount` decimal(10,2) NOT NULL DEFAULT 0.00,
  `createdAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `clientId_idx` (`clientId`),
  CONSTRAINT `fk_project_client` FOREIGN KEY (`clientId`) REFERENCES `clients` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------
-- Table structure for table `payments`
-- --------------------------------------------------------

CREATE TABLE `payments` (
  `id` varchar(50) NOT NULL,
  `projectId` varchar(50) NOT NULL,
  `amount` decimal(10,2) NOT NULL DEFAULT 0.00,
  `status` enum('pending','received','overdue') DEFAULT 'pending',
  `dueDate` datetime DEFAULT NULL,
  `receivedAt` datetime DEFAULT NULL,
  `createdAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `projectId_idx` (`projectId`),
  CONSTRAINT `fk_payment_project` FOREIGN KEY (`projectId`) REFERENCES `projects` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------
-- Seeding data from freelancer-data.json
-- --------------------------------------------------------

-- Seeding Clients
INSERT INTO `clients` (`id`, `name`, `email`, `phone`, `company`, `createdAt`) VALUES
('mlkz5nv78hhdz4u7dbp', 'Client gull', '', '', 'Whatsapp', '2026-02-13 14:20:13'),
('mll57b74rkyxepdmlzi', 'Client I', '', '', 'Whatsapp', '2026-02-13 17:09:28'),
('mll58i9maouber5apg', 'Client Maria', '', '', 'Whatsapp', '2026-02-13 17:10:23'),
('mll5beq4fm8se4fmgrg', 'Client Irum', '', '', 'Whatsapp', '2026-02-13 17:12:39'),
('mll5cwr69sljggxdr7', 'Client Shahzaib ', '', '', 'Whatsapp', '2026-02-13 17:13:49'),
('mll5d7tlkj7i4riyeq', 'Client Bushra', '', '', 'Whatsapp', '2026-02-13 17:14:03'),
('mll5deqtxnt304ih8m', 'Client Sohail', '', '', 'Whatsapp', '2026-02-13 17:14:12');

-- Seeding Projects
INSERT INTO `projects` (`id`, `clientId`, `title`, `description`, `deadline`, `status`, `deliveredAt`, `amount`, `createdAt`) VALUES
('mll551ld7ixdfx6z3x2', 'mlkz5nv78hhdz4u7dbp', 'Plant dosease detection ', 'Report + ppt plant disease detection ', '2026-02-09', 'delivered', NULL, 8000.00, '2026-02-13 17:07:42'),
('mll55y99395k3qf85eu', 'mlkz5nv78hhdz4u7dbp', 'Phishing', '2000 words report phishing ', '2026-02-14', 'in-progress', NULL, 2000.00, '2026-02-13 17:08:24'),
('mll56sp0mdsw5qpo2j9', 'mlkz5nv78hhdz4u7dbp', 'Report ', 'Luqman ref 1k report', '2026-02-08', 'delivered', NULL, 1000.00, '2026-02-13 17:09:04'),
('mll583mh664aojngfi', 'mll57b74rkyxepdmlzi', 'Web app', 'Frontendweb nova proj', '2026-02-11', 'delivered', NULL, 6000.00, '2026-02-13 17:10:04'),
('mll5a3fr45bsz4aqwl', 'mll58i9maouber5apg', 'Complaint Ai', 'Ai report and Ai workload diagram Mapping', '2026-02-12', 'delivered', NULL, 3500.00, '2026-02-13 17:11:37'),
('mll5c7pqnue4koin5vi', 'mll5beq4fm8se4fmgrg', 'Letter', 'Use this template letter 2000 words', '2026-02-12', 'delivered', NULL, 2000.00, '2026-02-13 17:13:16'),
('mll5eclcl0ethzhd8d', 'mll5deqtxnt304ih8m', 'HMS', 'Dissertation fyp 1 ', '2026-02-11', 'delivered', NULL, 12000.00, '2026-02-13 17:14:56'),
('mll5h8xzovphcum4pno', 'mll5deqtxnt304ih8m', 'Segun', 'Reports+ simon game + apps', '2026-02-20', 'delivered', NULL, 20000.00, '2026-02-13 17:17:11'),
('mll5ihgyxcmn748noft', 'mll5deqtxnt304ih8m', 'QA', 'Software QA testing report ', '2026-02-20', 'delivered', NULL, 4000.00, '2026-02-13 17:18:09'),
('mll5msodmj6acdttyw', 'mll57b74rkyxepdmlzi', 'Data Analysis', 'Documentation patient triage Ai grp', '2026-02-15', 'in-progress', NULL, 4500.00, '2026-02-13 17:21:30'),
('mll5oukj0wefeo1ffwo', 'mll5deqtxnt304ih8m', 'Uml', 'Uml diagrams 2', '2026-02-14', 'in-progress', NULL, 4000.00, '2026-02-13 17:23:06');

-- Seeding Payments
INSERT INTO `payments` (`id`, `projectId`, `amount`, `status`, `dueDate`, `receivedAt`, `createdAt`) VALUES
('mll551lfildn416j1in', 'mll551ld7ixdfx6z3x2', 8000.00, 'pending', '2026-02-16 00:00:00', NULL, '2026-02-13 17:07:42'),
('mll55y9969wnoon49r7', 'mll55y99395k3qf85eu', 2000.00, 'pending', '2026-02-21 00:00:00', NULL, '2026-02-13 17:08:24'),
('mll56sp0lvm2huoh5y', 'mll56sp0mdsw5qpo2j9', 1000.00, 'pending', '2026-02-15 00:00:00', NULL, '2026-02-13 17:09:04'),
('mll583mhlelfxt8krij', 'mll583mh664aojngfi', 6000.00, 'pending', '2026-02-18 00:00:00', NULL, '2026-02-13 17:10:04'),
('mll5a3frpg893nc7a7q', 'mll5a3fr45bsz4aqwl', 3500.00, 'pending', '2026-02-19 00:00:00', NULL, '2026-02-13 17:11:37'),
('mll5c7pq5739hnazia3', 'mll5c7pqnue4koin5vi', 2000.00, 'pending', '2026-02-19 00:00:00', NULL, '2026-02-13 17:13:16'),
('mll5eclcqxkt89p8ted', 'mll5eclcl0ethzhd8d', 12000.00, 'pending', '2026-02-18 00:00:00', NULL, '2026-02-13 17:14:56'),
('mll5h8xzj6uxroflyab', 'mll5h8xzovphcum4pno', 20000.00, 'pending', '2026-02-27 00:00:00', NULL, '2026-02-13 17:17:11'),
('mll5ihgyorb0d2ed82', 'mll5ihgyxcmn748noft', 4000.00, 'pending', '2026-02-27 00:00:00', NULL, '2026-02-13 17:18:09'),
('mll5msodww9qhi4ox78', 'mll5msodmj6acdttyw', 4500.00, 'pending', '2026-02-22 00:00:00', NULL, '2026-02-13 17:21:30'),
('mll5oukjo5fo5ympjxo', 'mll5oukj0wefeo1ffwo', 4000.00, 'pending', '2026-02-21 00:00:00', NULL, '2026-02-13 17:23:06');

COMMIT;
