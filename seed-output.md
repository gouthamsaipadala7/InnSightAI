# Seed data — login credentials & synthetic history summary

> **Local development only.** These are plaintext demo passwords for 3 seeded hotels. Never reuse this pattern in a real deployment.

## Grand Palace Hotel

- Hotel ID: `00a10248-39f1-4a1a-ad7a-15cfc50851ca`
- Total rooms: 24

| Role | Username | Password | Name |
|------|----------|----------|------|
| receptionist | `grandpalace.reception` | `Reception@123` | Ananya Rao |
| manager | `grandpalace.manager` | `Manager@123` | Vikram Shah |

Synthetic history: 270 days, 3604 backdated bookings. Injected demand spikes: 2026-02-26 to 2026-03-05; 2026-06-26 to 2026-07-05.

## Seaside Resort

- Hotel ID: `b853c1c3-22e6-4d63-94a4-8631b254c43c`
- Total rooms: 30

| Role | Username | Password | Name |
|------|----------|----------|------|
| receptionist | `seaside.reception` | `Reception@123` | Divya Menon |
| manager | `seaside.manager` | `Manager@123` | Arjun Nair |

Synthetic history: 270 days, 4935 backdated bookings. Injected demand spikes: 2026-02-11 to 2026-02-19; 2026-07-16 to 2026-07-24.

## Metro Business Hotel

- Hotel ID: `7f5d174f-3c22-40ad-9a57-4ebf0aa349ce`
- Total rooms: 20

| Role | Username | Password | Name |
|------|----------|----------|------|
| receptionist | `metrobiz.reception` | `Reception@123` | Kiran Patel |
| manager | `metrobiz.manager` | `Manager@123` | Sneha Iyer |

Synthetic history: 270 days, 2540 backdated bookings. Injected demand spikes: 2026-03-23 to 2026-03-31; 2026-05-27 to 2026-06-04.

---

All three hotels' `daily_booking_counts` tables are now populated and ready for the Prophet + pooled-XGBoost forecasting layer (Track B).