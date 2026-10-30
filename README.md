# Polished Nail Studio

A responsive nail salon booking and DIY nail-products shop prototype built with Express and vanilla JavaScript.

## Run locally

1. Install Node.js 18 or newer.
2. In this folder, run `npm install`.
3. Run `npm start`.
4. Visit `http://localhost:3000`.

Default demo administrator:
- Email: `admin@nailstudio.com`
- Password: `admin123`

Change/remove the demo admin credentials and use persistent, production-grade storage before deploying publicly. This app uses a local JSON file (`data.json`) as its prototype database.

## Included features

- Professional salon-style design: announcement bar, sticky header with Book now button, hero, services menu, reviews strip, and a full footer with hours. Edit the address and opening hours in `public/index.html`.
- Login and account registration.
- Nail inspiration gallery with category filters and saved favourites.
- Appointment booking, available time slots, customer cancellations and rescheduling.
- Shop catalogue, search, favourites, cart, stock checks and checkout form.
- Demo promo code `POLISHED10` (10% discount, calculated again by the server).
- Customer dashboard with bookings, orders, profile editing and demo loyalty points.
- Customer reviews after completed appointments, plus admin review moderation.
- Admin dashboard with order-value metrics, a monthly appointment calendar, order and product management, customer list, low-stock alert count, and CSV exports.
- Admin **Records** tab: spreadsheet-style tables of sign-ups, logins, purchases (one row per item) and bookings, with sorting, search and CSV download. Sign-ups and logins are recorded from the moment this version is first run; customers who joined earlier show "—" for their sign-up date.
- Card, Apple Pay and Google Pay choices displayed in demo checkout.

## Important production notes

- **Payments are not live.** Orders are marked `demo_unpaid`. No card details are collected and no money is charged. To take real payments, integrate a provider such as Stripe using server-side payment intents/checkout sessions, provider webhooks, and the provider's supported Apple Pay/Google Pay setup. Never store raw card numbers or CVVs.
- Email receipts, appointment reminders, password reset emails, and SMS notifications need an email/SMS provider and configured credentials; they are not sent by this prototype.
- Loyalty points are currently derived as a demo balance (50 per completed appointment, 25 per delivered order). No rewards are redeemable yet.
- Gallery artwork uses illustrative emoji/CSS visuals; replace with properly licensed studio photos for production.
- Favourites are saved in the browser's local storage, so they are not synced across devices.
- Before public launch, add rate limiting, stronger session management, CSRF protections where applicable, audit logging, automated backups, and a production database. Rotate the demo administrator password.
