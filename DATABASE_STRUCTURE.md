# Database Structure

Current build: **2026-06-06a**  
Current schema: **134**

Schema 134 adds DB-visible queues for payment write paths, reconciliation scoring rules, equipment accessory templates, local SEO generation, and mobile offline conflict resolution. The canonical schema remains `sql/000_full_schema_reference.sql`, and the latest standalone migration is `sql/133_payment_recon_equipment_seo_offline_execution_controls.sql`.
