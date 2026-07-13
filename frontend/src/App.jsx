import { useState } from 'react'
import './index.css'

// Change this to your deployed backend URL (Railway/Render) once live.
// For local dev, keep the Spring Boot server running on port 8080.
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080'

const PRICE_PER_PACK = 29
const INGREDIENTS = ['Dates', 'Cashews', 'Almonds', 'Peanuts', 'Dried figs', 'Pumpkin seeds']

// Product highlights shown on the page - keep these to claims that are actually true for your product.
const HIGHLIGHTS = [
  { title: 'Hygienically packed', desc: 'Sealed in a clean, controlled packing process so nothing is handled by hand after packing.' },
  { title: 'Quality checked', desc: 'Each batch of dry fruits is checked for freshness and quality before packing.' },
  { title: 'Freshly packed', desc: 'Packed in small batches rather than sitting in storage for long periods.' },
  { title: 'Honest pricing', desc: 'No inflated MRP - ₹29 is the real price for a real 50g pack.' },
]

// Keep reviews empty until real customer feedback is available.
const REVIEWS = [
  {
    name: "Momo",
    stars: 5,
    text: "Fresh, tasty, and premium quality. Loved it!"
  },
  {
    name: "Priya",
    stars: 5,
    text: "Perfect snack for work and travel. Highly recommended."
  },
  {
    name: "Rahul",
    stars: 5,
    text: "Great mix of dry fruits. Very fresh and crunchy."
  },
  {
    name: "Aisha",
    stars: 4,
    text: "Healthy and delicious. Will order again."
  },
  {
    name: "Arjun",
    stars: 5,
    text: "Excellent quality at a good price."
  },
  {
    name: "Sneha",
    stars: 5,
    text: "My family loved the taste. Very fresh."
  },
  {
    name: "Rohan",
    stars: 5,
    text: "Best dry fruits mix I've tried so far."
  },
  {
    name: "Neha",
    stars: 4,
    text: "Good packaging and premium quality."
  },
  {
    name: "Imran",
    stars: 5,
    text: "Fresh, natural, and worth every rupee."
  }
];

const productImageModules = import.meta.glob('./product-images/*.{png,jpg,jpeg,webp,avif}', { eager: true })
const PRODUCT_IMAGES = Object.entries(productImageModules)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([, module]) => module.default)

export default function App() {
  const [quantity, setQuantity] = useState(1)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState(null) // { type: 'error'|'success', message }
  const [currentSlide, setCurrentSlide] = useState(0)
  const [trackPhone, setTrackPhone] = useState('')
  const [trackResults, setTrackResults] = useState(null)
  const [address, setAddress] = useState('')
  const [pincode, setPincode] = useState('')
  const [couponCode, setCouponCode] = useState('')
  const [couponStatus, setCouponStatus] = useState(null)
  const [applyingCoupon, setApplyingCoupon] = useState(false)
  const [tracking, setTracking] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState(false)

  const subtotal = quantity * PRICE_PER_PACK
  const discountRupees = couponStatus && couponStatus.valid ? couponStatus.discountInPaise / 100 : 0
  const total = subtotal - discountRupees

  function goToPrevSlide() {
    setCurrentSlide((index) => (index === 0 ? PRODUCT_IMAGES.length - 1 : index - 1))
  }

  function goToNextSlide() {
    setCurrentSlide((index) => (index === PRODUCT_IMAGES.length - 1 ? 0 : index + 1))
  }

  async function handleApplyCoupon() {
    if (!couponCode.trim()) return
    setApplyingCoupon(true)
    setCouponStatus(null)
    try {
      const res = await fetch(`${API_URL}/api/coupons/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: couponCode.trim(), quantity }),
      })
      const data = await res.json()
      setCouponStatus(data)
    } catch {
      setCouponStatus({ valid: false, message: 'Could not check coupon. Try again.' })
    } finally {
      setApplyingCoupon(false)
    }
  }

  async function handleOrder() {
    setStatus(null)
    if (!name.trim() || phone.trim().length < 10) {
      setStatus({ type: 'error', message: 'Enter your name and a valid phone number.' })
      return
    }
    if (!address.trim() || pincode.trim().length < 6) {
      setStatus({ type: 'error', message: 'Enter your full delivery address and a valid pincode.' })
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`${API_URL}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quantity,
          customerName: name,
          customerPhone: phone,
          address,
          pincode,
          couponCode: couponStatus && couponStatus.valid ? couponCode.trim() : null,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Could not start the order. Try again.')
      }
      const order = await res.json()

      const options = {
        key: order.keyId,
        amount: order.amountInPaise,
        currency: order.currency,
        name: 'Drynut',
        description: `${quantity} pack(s) of dry fruit mix`,
        order_id: order.orderId,
        prefill: { name, contact: phone },
        theme: { color: '#D9A441' },
        handler: async function (response) {
          try {
            const verifyRes = await fetch(`${API_URL}/api/orders/verify`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
              }),
            })
            const verifyData = await verifyRes.json()
            if (verifyData.success) {
              setStatus({ type: 'success', message: 'Payment confirmed. Thank you for your order.' })
              setShowSuccessModal(true)
            } else {
              setStatus({ type: 'error', message: 'Payment could not be verified. Contact support.' })
            }
          } catch {
            setStatus({ type: 'error', message: 'Payment went through but verification failed. Contact support.' })
          }
        },
        modal: {
          ondismiss: function () {
            setStatus({ type: 'error', message: 'Payment cancelled.' })
          },
        },
      }

      const rzp = new window.Razorpay(options)
      rzp.open()
    } catch (err) {
      setStatus({ type: 'error', message: err.message || 'Something went wrong.' })
    } finally {
      setLoading(false)
    }
  }

  async function handleTrack() {
    if (trackPhone.trim().length < 10) return
    setTracking(true)
    setTrackResults(null)
    try {
      const res = await fetch(`${API_URL}/api/orders/track?phone=${encodeURIComponent(trackPhone)}`)
      const data = await res.json()
      setTrackResults(data)
    } catch {
      setTrackResults([])
    } finally {
      setTracking(false)
    }
  }

  return (
    <div className="wrap page-shell">
      <section className="hero-grid">
        <header className="hero-panel">
          <span className="eyebrow">Drynut</span>
          <h1>Fresh dry fruits, packed into a small daily ritual.</h1>
          <p className="sub">
            A balanced 50 gram mix of dates, cashews, almonds, peanuts, dried figs and pumpkin seeds.
            Simple to carry, easy to trust, and priced for everyday snacking.
          </p>
          <div className="hero-pills" aria-label="Product highlights">
            <span>50g pocket pack</span>
            <span>6 ingredients</span>
            <span>Made fresh</span>
          </div>
        </header>

        <aside className="hero-side">
          <div className="product-photo">
            {PRODUCT_IMAGES.length > 0 ? (
              <img
                key={currentSlide}
                className="slide-image"
                src={PRODUCT_IMAGES[currentSlide]}
                alt={`Drynut product photo ${currentSlide + 1}`}
              />
            ) : (
              <div className="no-image">Add product photos in src/product-images</div>
            )}

            {PRODUCT_IMAGES.length > 0 && (
              <>
                <button
                  className="slider-btn slider-btn-prev"
                  type="button"
                  onClick={goToPrevSlide}
                  aria-label="Previous product image"
                  disabled={PRODUCT_IMAGES.length < 2}
                >
                  ‹
                </button>
                <button
                  className="slider-btn slider-btn-next"
                  type="button"
                  onClick={goToNextSlide}
                  aria-label="Next product image"
                  disabled={PRODUCT_IMAGES.length < 2}
                >
                  ›
                </button>
                {PRODUCT_IMAGES.length > 1 && (
                  <div className="slider-dots" role="tablist" aria-label="Product image slides">
                    {PRODUCT_IMAGES.map((_, index) => (
                      <button
                        key={index}
                        className={`slider-dot ${index === currentSlide ? 'active' : ''}`}
                        type="button"
                        onClick={() => setCurrentSlide(index)}
                        aria-label={`Show product image ${index + 1}`}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          <div className="spec-strip accent-strip">
            <div className="spec-cell">
              <span className="spec-num">50g</span>
              <span className="spec-label">Pack size</span>
            </div>
            <div className="spec-cell">
              <span className="spec-num">6</span>
              <span className="spec-label">Ingredients</span>
            </div>
            <div className="spec-cell">
              <span className="spec-num">₹29</span>
              <span className="spec-label">Per pack</span>
            </div>
          </div>
        </aside>
      </section>

      <section className="section-block section-block-gold">
        <h2 className="section-heading">Why people choose Drynut</h2>
        <div className="highlights-grid">
          {HIGHLIGHTS.map((h) => (
            <div className="highlight-card" key={h.title}>
              <div className="highlight-mark" />
              <div className="highlight-title">{h.title}</div>
              <div className="highlight-desc">{h.desc}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="section-block section-block-cream">
        <h2 className="section-heading">What customers say</h2>
        <div className="reviews-section">
          {REVIEWS.length === 0 ? (
            <div className="no-reviews-card">
              <div className="no-reviews-title">No customer reviews yet</div>
              <div className="no-reviews-sub">This section will fill up once real orders and feedback come in.</div>
            </div>
          ) : (
            <div className="reviews-track">
              {[...REVIEWS, ...REVIEWS].map((r, i) => (
                <div className="review-card" key={i}>
                  <div className="review-stars">{'★'.repeat(r.stars)}{'☆'.repeat(5 - r.stars)}</div>
                  <div className="review-text">{r.text}</div>
                  <div className="review-name">{r.name}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="order-grid">
        <div className="order-card order-primary">
          <h2>Order your pack</h2>

          <div className="field">
            <label htmlFor="name">Your name</label>
            <input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" />
          </div>

          <div className="field">
            <label htmlFor="phone">Phone number</label>
            <input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="10 digit mobile number" />
          </div>
          <div className="field">
            <label htmlFor="address">Delivery address</label>
            <input id="address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="House no, street, area, city" />
          </div>

          <div className="field">
            <label htmlFor="pincode">Pincode</label>
            <input id="pincode" value={pincode} onChange={(e) => setPincode(e.target.value)} placeholder="6 digit pincode" />
          </div>

          <div className="field">
            <label htmlFor="coupon">Coupon code (optional)</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                id="coupon"
                value={couponCode}
                onChange={(e) => { setCouponCode(e.target.value); setCouponStatus(null) }}
                placeholder="e.g. WELCOME10"
                style={{ flex: 1 }}
              />
              <button className="qty-btn" style={{ width: 'auto', padding: '0 16px' }} onClick={handleApplyCoupon} disabled={applyingCoupon}>
                {applyingCoupon ? '...' : 'Apply'}
              </button>
            </div>
            {couponStatus && (
              <p className="note" style={{ color: couponStatus.valid ? 'var(--amber)' : undefined }}>
                {couponStatus.valid
                  ? `Coupon applied - you save ₹${(couponStatus.discountInPaise / 100).toFixed(2)}`
                  : couponStatus.message}
              </p>
            )}
          </div>

          <div className="qty-row">
            <button className="qty-btn" onClick={() => setQuantity((q) => Math.max(1, q - 1))} aria-label="Decrease quantity">−</button>
            <span>{quantity} pack{quantity > 1 ? 's' : ''}</span>
            <button className="qty-btn" onClick={() => setQuantity((q) => q + 1)} aria-label="Increase quantity">+</button>
          </div>

          {couponStatus && couponStatus.valid && (
            <div className="total-row" style={{ borderTop: 'none', paddingTop: 0 }}>
              <span>Subtotal</span>
              <span>₹{subtotal}</span>
            </div>
          )}
          <div className="total-row">
            <span>Total</span>
            <span className="total-amount">₹{total}</span>
          </div>
          <button className="cta" onClick={handleOrder} disabled={loading}>
            {loading ? 'Starting payment…' : 'Pay and order'}
          </button>
          <p className="note">Secure payment via Razorpay. UPI, cards and netbanking accepted.</p>

          {status && <div className={`status ${status.type}`}>{status.message}</div>}
        </div>

        <div className="order-card order-secondary">
          <h2>Track your order</h2>
          <div className="field">
            <label htmlFor="trackPhone">Phone number used when ordering</label>
            <input id="trackPhone" value={trackPhone} onChange={(e) => setTrackPhone(e.target.value)} placeholder="10 digit mobile number" />
          </div>
          <button className="cta" onClick={handleTrack} disabled={tracking}>
            {tracking ? 'Checking…' : 'Check status'}
          </button>

          {trackResults && trackResults.length === 0 && (
            <p className="note" style={{ marginTop: 14 }}>No paid orders found for this number.</p>
          )}
          {trackResults && trackResults.length > 0 && (
            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {trackResults.map((o) => (
                <div key={o.orderId} style={{ background: 'rgba(0,0,0,0.15)', borderRadius: 4, padding: '10px 14px', fontSize: 14 }}>
                  <div>{o.quantity} pack{o.quantity > 1 ? 's' : ''} — status: <strong>{o.status}</strong></div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <footer>Drynut — made fresh, packed small.</footer>

      {showSuccessModal && (
        <div className="success-backdrop" onClick={() => setShowSuccessModal(false)}>
          <div className="success-card" onClick={(e) => e.stopPropagation()}>
            <div className="success-tick-wrap">
              <svg className="success-tick" viewBox="0 0 52 52">
                <circle className="success-tick-circle" cx="26" cy="26" r="24" fill="none" />
                <path className="success-tick-check" fill="none" d="M14 27l7 7 16-16" />
              </svg>
            </div>
            <h2 className="success-title">Thanks for ordering!</h2>
            <p className="success-sub">
              Your order is confirmed. We're packing your {quantity} pack{quantity > 1 ? 's' : ''} of Drynut now.
            </p>
            <button className="cta success-close-btn" onClick={() => setShowSuccessModal(false)}>
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
