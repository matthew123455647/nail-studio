# Polished Nail Studio

A responsive nail salon booking and DIY nail-products shop prototype built with Express and vanilla JavaScript.

## Run Locally

1. Install Node.js 18 or newer.
2. Open this project folder in VS Code.
3. Open the terminal.
4. Install the dependencies:

   ```bash
   npm install
   ```

5. Start the application:

   ```bash
   npm start
   ```

6. Visit [http://localhost:3000](http://localhost:3000) in your browser.

### Default Demo Administrator

- **Email:** `admin@nailstudio.com`
- **Password:** `admin123`

**Security notice:** Change or remove the demo administrator credentials and configure persistent, production-grade storage before deploying publicly.

This application currently uses a local JSON file (`data.json`) as its prototype database.

## Included Features

### Website Design
- Professional salon-style design.
- Announcement bar.
- Sticky navigation header with a Book Now button.
- Homepage hero section.
- Services menu.
- Customer reviews strip.
- Full website footer with business hours.
- Responsive layout for different screen sizes.

Edit the salon address and opening hours in `public/index.html`.

### Customer Accounts
- Customer login.
- Account registration.
- Customer dashboard.
- Profile editing.
- Demo loyalty points.

### Nail Inspiration Gallery
- Nail inspiration gallery.
- Category filters.
- Saved favourites.

### Appointment Booking
- Appointment booking system.
- Available appointment time slots.
- Customer appointment cancellations.
- Appointment rescheduling.

### Online Shop
- Nail products catalogue.
- Product search.
- Product favourites.
- Shopping cart.
- Stock availability checks.
- Checkout form.
- Demo promo code `POLISHED10` (10% discount, calculated again by the server).

### Customer Dashboard
- View appointments.
- View orders.
- Edit customer profile.
- View demo loyalty points.

### Customer Reviews
- Customers can submit reviews after completed appointments.
- Admin review moderation.

### Admin Dashboard
- Order-value metrics.
- Monthly appointment calendar.
- Order management.
- Product management.
- Customer list.
- Low-stock alert count.
- CSV exports.

### Admin Records
The admin dashboard includes a **Records** tab with spreadsheet-style tables for:

- Customer sign-ups.
- Customer logins.
- Purchases (one row per item).
- Appointment bookings.

Additional functionality:
- Sorting.
- Search.
- CSV downloads.

Sign-ups and logins are recorded from the moment this version is first run. Customers who registered earlier show `—` for their sign-up date.

### Demo Checkout
The checkout interface displays the following payment options:

- Card.
- Apple Pay.
- Google Pay.

These are demonstration payment options only. Real payment processing has not been implemented.

## Important Production Notes

### 1. Payments Are Not Live

Orders are currently marked `demo_unpaid`.

No card details are collected, and no money is charged.

To accept real payments, integrate a payment provider such as Stripe using:

- Server-side payment intents or checkout sessions.
- Payment provider webhooks.
- Supported Apple Pay and Google Pay integration.

Never store raw card numbers or CVVs.

### 2. Email and SMS Notifications

The following features require an external email or SMS provider and configured credentials:

- Email receipts.
- Appointment reminders.
- Password reset emails.
- SMS notifications.

These notifications are not currently sent by this prototype.

### 3. Loyalty Points

Loyalty points are currently calculated using a demonstration balance:

- 50 points per completed appointment.
- 25 points per delivered order.

Rewards are not redeemable yet.

### 4. Gallery Images

Gallery artwork currently uses illustrative emoji and CSS visuals.

Replace these with properly licensed salon and nail-design photographs before production.

### 5. Customer Favourites

Favourites are stored in the browser's local storage.

They are not synchronised across different devices.

### 6. Database and Data Persistence

The application currently uses a local JSON file (`data.json`) as its prototype database.

Before public production deployment, migrate to a persistent database such as PostgreSQL.

Do not rely on temporary server storage for customer accounts, appointments, orders or product records.

### 7. Security and Production Readiness

Before launching publicly:

- Add rate limiting.
- Implement stronger session management.
- Add CSRF protections where applicable.
- Implement audit logging.
- Configure automated database backups.
- Use a production-grade database.
- Rotate the default demo administrator password.
- Store sensitive configuration and credentials in environment variables.
- Use HTTPS for public access.

## Technologies Used

- **Backend:** Node.js and Express.
- **Frontend:** HTML, CSS and Vanilla JavaScript.
- **Database:** Local JSON file (prototype).
- **Package Manager:** npm.

## Project Structure

```text
nail-studio/
│
├── public/
│   ├── index.html
│   ├── styles.css
│   └── app.js
│
├── package.json
├── package-lock.json
├── server.js
├── README.md
└── .gitignore
```

## License

This project is currently a personal nail salon website prototype.
