CREATE TABLE `product_catalog` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `evo_pattern` text NOT NULL,
  `sat_product_key` text NOT NULL,
  `sat_description` text NOT NULL
);

CREATE TABLE `customer_fiscal` (
  `rfc` text PRIMARY KEY NOT NULL,
  `legal_name` text NOT NULL,
  `zip` text NOT NULL,
  `tax_system` text NOT NULL,
  `cfdi_use` text,
  `payment_form` text,
  `email` text,
  `updated_at` text NOT NULL
);
