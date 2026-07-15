import { useState } from 'react'
import './index.css'

// Change this to your deployed backend URL (Railway/Render) once live.
// For local dev, keep the Spring Boot server running on port 8080.
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080'

const PRICE_PER_PACK = 29
const MRP_PER_PACK = 50
const INGREDIENTS = ['Dates', 'Cashews', 'Almonds', 'Peanuts', 'Dried figs', 'Pumpkin seeds']

// Set this to your actual WhatsApp support number (with country code, no + or spaces),
// e.g. "919876543210" for a +91 98765 43210 number. Leave blank to hide the button.
const WHATSAPP_SUPPORT_NUMBER = "917780113910"

// Product highlights shown on the page - keep these to claims that are actually true for your product.
const HIGHLIGHTS = [
  { title: 'Hygienically packed', desc: 'Sealed in a clean, controlled packing process so nothing is handled by hand after packing.' },
  { title: 'Quality checked', desc: 'Each batch of dry fruits is checked for freshness and quality before packing.' },
  { title: 'Freshly packed', desc: 'Packed in small batches rather than sitting in storage for long periods.' },
  { title: 'Honest pricing', desc: 'No inflated MRP - ₹29 is the real price for a real 50g pack.' },
]

// Keep reviews empty until real customer feedback is available.
const REVIEWS = [
  { name: "Momo", stars: 5, text: "Super fresh and crunchy. Loved the taste!" },
  { name: "Ayaan", stars: 5, text: "Excellent quality. Will order again." },
  { name: "Priya", stars: 5, text: "Healthy, tasty, and perfectly packed." },
  { name: "Rahul", stars: 4, text: "Good mix of dry fruits. Worth the price." },
  { name: "Zara", stars: 5, text: "Premium quality and very fresh." },
  { name: "Rohan", stars: 5, text: "Perfect snack for my gym routine." },
  { name: "Aisha", stars: 5, text: "Loved the flavor and freshness." },
  { name: "Vikram", stars: 5, text: "Great packaging and fast delivery." },
  { name: "Neha", stars: 4, text: "Fresh, crunchy, and delicious." },
  { name: "Abdulla", stars: 5, text: "Best dry fruits I've purchased online." },
]

// Customer-facing tracking stages. Your backend's /api/orders/track endpoint
// only ever returns orders where paid=true, and OrderEntity.status is one of:
// CONFIRMED, PACKED, SHIPPED, DELIVERED (there's no PENDING/CANCELLED status -
// an order that hasn't been paid yet simply never shows up in tracking results).
const TRACKING_STAGES = ['Confirmed', 'Packed', 'Shipped', 'Delivered']

// Standard delivery window shown to customers, in days from the order date.
const DELIVERY_DAYS = 6

function getStageIndex(status) {
  switch ((status || '').toUpperCase()) {
    case 'CONFIRMED':
      return 0
    case 'PACKED':
      return 1
    case 'SHIPPED':
      return 2
    case 'DELIVERED':
      return 3
    default:
      return 0
  }
}

// Estimates a delivery date DELIVERY_DAYS after the given date (defaults to now).
// Accepts a Date, a date string/timestamp, or nothing.
function getEstimatedDeliveryDate(fromDate) {
  const base = fromDate ? new Date(fromDate) : new Date()
  const date = new Date(base)
  date.setDate(date.getDate() + DELIVERY_DAYS)
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

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
  const [errorModal, setErrorModal] = useState(null) // string message or null
  const [lastOrderId, setLastOrderId] = useState(null)
  const [copiedOrderId, setCopiedOrderId] = useState(false)
  const [orderPlacedAt, setOrderPlacedAt] = useState(null)

  const subtotal = quantity * PRICE_PER_PACK
  const discountRupees = couponStatus && couponStatus.valid ? couponStatus.discountInPaise / 100 : 0
  const total = Math.max(0, subtotal - discountRupees)

  // Simple, real-time validation so people find out about a typo'd phone number
  // or pincode before they even reach payment, not after.
  const phoneDigits = phone.replace(/\D/g, '')
  const pincodeDigits = pincode.replace(/\D/g, '')
  const phoneError = phone.length > 0 && phoneDigits.length !== 10 ? 'Enter a valid 10 digit mobile number.' : null
  const pincodeError = pincode.length > 0 && pincodeDigits.length !== 6 ? 'Enter a valid 6 digit pincode.' : null

  // Razorpay rejects orders below ₹1. With coupons this could theoretically push
  // the total to ₹0 or less, so guard against that before ever hitting checkout.
  const belowMinimumAmount = total < 1

  function handlePhoneChange(e) {
    const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 10)
    setPhone(digitsOnly)
  }

  function handlePincodeChange(e) {
    const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 6)
    setPincode(digitsOnly)
  }

  function handleTrackPhoneChange(e) {
    const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 10)
    setTrackPhone(digitsOnly)
  }

  function scrollToOrderSection() {
    document.getElementById('order-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function copyOrderId() {
    if (!lastOrderId) return
    navigator.clipboard?.writeText(lastOrderId).then(() => {
      setCopiedOrderId(true)
      setTimeout(() => setCopiedOrderId(false), 2000)
    })
  }

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
    if (!name.trim() || phoneDigits.length !== 10) {
      setStatus({ type: 'error', message: 'Enter your name and a valid phone number.' })
      return
    }
    if (!address.trim() || pincodeDigits.length !== 6) {
      setStatus({ type: 'error', message: 'Enter your full delivery address and a valid pincode.' })
      return
    }
    if (belowMinimumAmount) {
      setStatus({ type: 'error', message: 'Order amount is too low. Please increase quantity or remove the coupon.' })
      setErrorModal('This order total is below the minimum allowed amount. Try increasing the quantity or removing the coupon code.')
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
          customerPhone: phoneDigits,
          address,
          pincode: pincodeDigits,
          couponCode: couponStatus && couponStatus.valid ? couponCode.trim() : null,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Could not start the order. Try again.')
      }
      const order = await res.json()
      setLastOrderId(order.orderId)
      setOrderPlacedAt(new Date())

      const options = {
        key: order.keyId,
        amount: order.amountInPaise,
        currency: order.currency,
        name: 'Drynut',
        description: `${quantity} pack(s) of dry fruit mix`,
        order_id: order.orderId,
        prefill: { name, contact: phoneDigits },
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
              setErrorModal('We could not verify your payment. If money was deducted, please contact support with your phone number.')
            }
          } catch {
            setStatus({ type: 'error', message: 'Payment went through but verification failed. Contact support.' })
            setErrorModal('Your payment went through but verification failed on our end. Please contact support with your phone number.')
          }
        },
        modal: {
          ondismiss: function () {
            setStatus({ type: 'error', message: 'Payment cancelled.' })
            setErrorModal('Payment was cancelled. No amount has been charged.')
          },
        },
      }

      const rzp = new window.Razorpay(options)
      rzp.on('payment.failed', function (response) {
        setStatus({ type: 'error', message: 'Payment failed. Please try again.' })
        setErrorModal(
          response?.error?.description
            ? `Payment failed: ${response.error.description}`
            : 'Your payment could not be completed. No amount has been charged. Please try again.'
        )
      })
      rzp.open()
    } catch (err) {
      setStatus({ type: 'error', message: err.message || 'Something went wrong.' })
      setErrorModal(err.message || 'Something went wrong while starting your order. Please try again.')
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
          <button className="hero-order-btn" onClick={scrollToOrderSection}>
            Order now — <span className="strike">₹{MRP_PER_PACK}</span>
            ₹{PRICE_PER_PACK}/pack
          </button>
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
              <span className="spec-num">
                <span className="spec-mrp">₹{MRP_PER_PACK}</span>
                ₹{PRICE_PER_PACK}
              </span>
              <span className="spec-label">Per pack</span>
            </div>
          </div>

          <ul className="ingredients">
            {INGREDIENTS.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
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

      <section className="order-grid" id="order-section">
        <div className="order-card order-primary">
          <h2>Order your pack</h2>

          <div className="field">
            <label htmlFor="name">Your name</label>
            <input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" />
          </div>

          <div className="field">
            <label htmlFor="phone">Phone number</label>
            <input
              id="phone"
              value={phone}
              onChange={handlePhoneChange}
              placeholder="10 digit mobile number"
              inputMode="numeric"
              className={phoneError ? 'input-error' : ''}
            />
            {phoneError && <p className="field-error">{phoneError}</p>}
          </div>
          <div className="field">
            <label htmlFor="address">Delivery address</label>
            <input id="address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="House no, street, area, city" />
          </div>

          <div className="field">
            <label htmlFor="pincode">Pincode</label>
            <input
              id="pincode"
              value={pincode}
              onChange={handlePincodeChange}
              placeholder="6 digit pincode"
              inputMode="numeric"
              className={pincodeError ? 'input-error' : ''}
            />
            {pincodeError && <p className="field-error">{pincodeError}</p>}
          </div>

          <div className="field">
            <label htmlFor="coupon">Coupon code (optional)</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                id="coupon"
                value={couponCode}
                onChange={(e) => { setCouponCode(e.target.value.toUpperCase()); setCouponStatus(null) }}
                placeholder="e.g. WELCOME10"
                style={{ flex: 1 }}
              />
              <button className="qty-btn" style={{ width: 'auto', padding: '0 16px' }} onClick={handleApplyCoupon} disabled={applyingCoupon || !couponCode.trim()}>
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

          <div className="price-summary">
            <div className="total-row-plain">
              <span>MRP ({quantity} × ₹{MRP_PER_PACK})</span>
              <span className="strike">₹{quantity * MRP_PER_PACK}</span>
            </div>
            {couponStatus && couponStatus.valid && (
              <div className="total-row-plain">
                <span>Subtotal</span>
                <span>₹{subtotal}</span>
              </div>
            )}
            <div className="total-row final">
              <span>Total</span>
              <span className="total-amount">₹{total}</span>
            </div>
            <p className="savings-note">
              You save ₹{quantity * MRP_PER_PACK - subtotal} on MRP{discountRupees > 0 ? ` + ₹${discountRupees.toFixed(2)} with coupon` : ''}
            </p>
            <div className="total-row-plain">
              <span>Estimated delivery</span>
              <span>{getEstimatedDeliveryDate()}</span>
            </div>
          </div>
          <button className="cta" onClick={handleOrder} disabled={loading || belowMinimumAmount}>
            {loading ? 'Starting payment…' : 'Pay and order'}
          </button>
          <p className="note">Secure payment via Razorpay. UPI, cards and netbanking accepted.</p>

          {status && <div className={`status ${status.type}`}>{status.message}</div>}
        </div>

        <div className="order-card order-secondary">
          <h2>Track your order</h2>
          <div className="field">
            <label htmlFor="trackPhone">Phone number used when ordering</label>
            <input
              id="trackPhone"
              value={trackPhone}
              onChange={handleTrackPhoneChange}
              placeholder="10 digit mobile number"
              inputMode="numeric"
            />
          </div>
          <button className="cta" onClick={handleTrack} disabled={tracking || trackPhone.length !== 10}>
            {tracking ? 'Checking…' : 'Check status'}
          </button>

          {trackResults && trackResults.length === 0 && (
            <p className="note" style={{ marginTop: 14 }}>No paid orders found for this number.</p>
          )}
          {trackResults && trackResults.length > 0 && (
            <div className="track-results">
              {trackResults.map((o) => {
                const isCancelled = (o.status || '').toUpperCase() === 'CANCELLED'
                const stageIndex = getStageIndex(o.status)
                return (
                  <div className="track-card" key={o.orderId}>
                    <div className="track-card-header">
                      <span>{o.quantity} pack{o.quantity > 1 ? 's' : ''}</span>
                      <span className="track-order-id">#{String(o.orderId).slice(-8)}</span>
                    </div>

                    {isCancelled ? (
                      <div className="track-cancelled">This order was cancelled.</div>
                    ) : (
                      <>
                        <div className="track-progress-wrap">
                          <div className="track-progress-track">
                            <div
                              className="track-progress-fill"
                              style={{ width: `${(stageIndex / (TRACKING_STAGES.length - 1)) * 100}%` }}
                            />
                          </div>
                          <span className="track-progress-pct">
                            {Math.round((stageIndex / (TRACKING_STAGES.length - 1)) * 100)}% complete
                          </span>
                        </div>
                        <div className="track-timeline">
                          {TRACKING_STAGES.map((stage, i) => (
                            <div className="track-step" key={stage}>
                              <div className="track-step-line-wrap">
                                {i > 0 && (
                                  <div className={`track-line ${i <= stageIndex ? 'done' : ''}`} />
                                )}
                              </div>
                              <div className={`track-dot ${i <= stageIndex ? 'done' : ''} ${i === stageIndex ? 'current' : ''}`}>
                                {i < stageIndex ? '✓' : ''}
                              </div>
                              <div className={`track-label ${i === stageIndex ? 'current' : ''}`}>{stage}</div>
                            </div>
                          ))}
                        </div>
                        {stageIndex < TRACKING_STAGES.length - 1 && (
                          <p className="note" style={{ marginTop: 8 }}>
                            Estimated delivery by {getEstimatedDeliveryDate(o.createdAt || o.orderDate)}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </section>

      <footer>Drynut — made fresh, packed small.</footer>

      {WHATSAPP_SUPPORT_NUMBER && (
        <a
          className="whatsapp-fab"
          href={`https://wa.me/${WHATSAPP_SUPPORT_NUMBER}?text=${encodeURIComponent('Hi Drynut, I need help with my order.')}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Chat with us on WhatsApp"
        >
          <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
            <path d="M12.004 2.003c-5.514 0-9.997 4.483-9.997 9.997 0 1.762.464 3.484 1.345 5.001L2 22l5.13-1.345a9.96 9.96 0 004.874 1.242h.004c5.514 0 9.997-4.483 9.997-9.997 0-2.671-1.04-5.182-2.929-7.071A9.929 9.929 0 0012.004 2.003zm0 18.164h-.003a8.153 8.153 0 01-4.15-1.137l-.298-.177-3.045.799.813-2.968-.194-.305a8.15 8.15 0 01-1.256-4.372c0-4.51 3.671-8.181 8.185-8.181a8.13 8.13 0 015.79 2.398 8.131 8.131 0 012.396 5.788c0 4.512-3.671 8.155-8.238 8.155z"/>
          </svg>
        </a>
      )}

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
            <p className="success-sub" style={{ fontWeight: 600 }}>
              Estimated delivery by {getEstimatedDeliveryDate(orderPlacedAt)}
            </p>
            {lastOrderId && (
              <button className="order-id-chip" onClick={copyOrderId} type="button">
                Order #{String(lastOrderId).slice(-8)} {copiedOrderId ? '· Copied!' : '· Tap to copy'}
              </button>
            )}
            <button className="cta success-close-btn" onClick={() => setShowSuccessModal(false)}>
              Done
            </button>
          </div>
        </div>
      )}

      {errorModal && (
        <div className="success-backdrop" onClick={() => setErrorModal(null)}>
          <div className="success-card error-card" onClick={(e) => e.stopPropagation()}>
            <div className="success-tick-wrap">
              <svg className="success-tick" viewBox="0 0 52 52">
                <circle className="error-tick-circle" cx="26" cy="26" r="24" fill="none" />
                <path className="error-tick-cross" fill="none" d="M17 17l18 18" />
                <path className="error-tick-cross error-tick-cross-2" fill="none" d="M35 17l-18 18" />
              </svg>
            </div>
            <h2 className="success-title">Order not completed</h2>
            <p className="success-sub">{errorModal}</p>
            <button className="cta error-close-btn" onClick={() => setErrorModal(null)}>
              Try again
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
