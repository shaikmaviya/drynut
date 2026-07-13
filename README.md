# Daily Mix — dry fruit pack pre-order site

A minimal site to test real demand for your 50g / ₹29 dry fruit mix pack:
a landing page, a "Pay and order" button, and Razorpay checkout.
Every completed payment is a real signal — someone paid actual money for the idea.

## What's inside
- `backend/` — Spring Boot API. Creates Razorpay orders, verifies payments, keeps a simple count of orders.
- `frontend/` — React (Vite) landing page with the order form and Razorpay checkout.

## 1. Run it locally first

**Backend**
```
cd backend
$env:RAZORPAY_KEY_ID="rzp_live_TCZ7bkPppI8oNb"
$env:RAZORPAY_KEY_SECRET="OedbLcH8vKdH6wapScCzREBx"
$env:FRONTEND_URL="http://localhost:5173"
$env:ADMIN_KEY="mysecret123"
$env:MAIL_USERNAME="officialdrynut@gmail.com"
$env:MAIL_PASSWORD="toyclcdgtxbogrgn"
$env:NOTIFY_EMAIL="officialdrynut@gmail.com"
mvn spring-boot:run
```
Runs on http://localhost:8080

**Frontend**
```
cd frontend
npm install
npm run dev
```
Runs on http://localhost:5173 — open it and test a full payment using
[Razorpay's test cards](https://razorpay.com/docs/payments/payments/test-card-upi-details/)
(use test mode keys, not live keys, while trying this out).

## 2. Add your own product photo
Drop your photo into `frontend/public/` (e.g. `product.jpg`), then in `src/App.jsx`
replace the placeholder `<div className="product-photo">` block with:
```jsx
<div className="product-photo">
  <img src="/product.jpg" alt="Daily Mix dry fruit pack" />
</div>
```

## 3. Deploy the backend — Railway
1. Push this whole folder to a GitHub repo.
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub repo.
3. Set the root directory to `backend` (Railway will detect the Dockerfile).
4. Add these environment variables in Railway's Variables tab:
   - `RAZORPAY_KEY_ID`
   - `RAZORPAY_KEY_SECRET`
   - `FRONTEND_URL` — your Vercel URL once you have it (step 4), e.g. `https://dailymix.vercel.app`
   - `ADMIN_KEY` — any secret string, used to view your order summary
5. Deploy. Railway gives you a public URL like `https://your-app.up.railway.app` — this is your `API_URL`.

## 4. Deploy the frontend — Vercel
1. Go to [vercel.com](https://vercel.com) → New Project → import the same GitHub repo.
2. Set the root directory to `frontend`.
3. Add an environment variable: `VITE_API_URL` = your Railway backend URL from step 3.
4. Deploy. Vercel gives you a public URL — share this with anyone to test buying a pack.
5. Go back to Railway and update `FRONTEND_URL` to this Vercel URL, then redeploy the backend
   (this is what allows the browser to call your API — without it you'll see CORS errors).

## 5. Go live with real payments
- Switch your Razorpay dashboard from Test mode to Live mode, and complete Razorpay's
  KYC/activation if you haven't (required before accepting real payments).
- Replace the test `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` in Railway with your live keys.

## 6. Check whether the idea is working
Visit:
```
https://your-railway-app.up.railway.app/api/orders/summary?key=YOUR_ADMIN_KEY
```
This shows how many people started checkout vs. actually completed payment, and how many
packs were sold. That gap (started vs. paid) is itself useful — a lot of "starts" but few
"paid" often means the price or trust signals need work, not the product idea.

## Notes and limits
- Orders are stored in memory on the backend — they reset if the server restarts. That's fine
  for a demand test; move to a real database (e.g. Postgres, which Railway can also host) once
  you're getting regular orders and want permanent records.
- This site takes payment but doesn't yet handle shipping/delivery logistics — add that once
  you've validated people will actually pay.
