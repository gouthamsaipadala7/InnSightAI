# Synthetic dataset v1 (paper experiments)

- Version tag: v1-unseeded (generated 2026-09-14 IST via prisma/seed.ts + prisma/synthetic-history.ts)
- Reproducibility: NOT seeded (Math.random). The CSV export in backups/ is the canonical copy. Do not regenerate.
- Hotels: Grand Palace, Seaside Resort, Metro Business (3)
- History: 270 days per hotel
- Counts at export: bookings 11091 (11079 synthetic + 12 live test rows), revenue_log 11091, customers 462 (450 synthetic), daily_booking_counts 816 (810 synthetic), rooms 74
- Marked in DB: is_synthetic = true, dataset_version = 'v1-unseeded'
- Backups: external drive + cloud copy (row_counts.json inside)
- Production training and dashboards must exclude is_synthetic rows unless explicitly labelled.