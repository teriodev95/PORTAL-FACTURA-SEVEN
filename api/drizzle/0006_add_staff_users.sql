CREATE TABLE `staff_users` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `email` text NOT NULL,
  `name` text NOT NULL,
  `role` text NOT NULL DEFAULT 'viewer',
  `password_hash` text NOT NULL,
  `created_at` text NOT NULL,
  `last_login` text
);
CREATE UNIQUE INDEX `staff_users_email_unique` ON `staff_users` (`email`);
