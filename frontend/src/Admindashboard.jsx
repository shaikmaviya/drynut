import { useState, useEffect, useMemo, useRef, useCallback } from 'react'

// Same backend used by the storefront.
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080'

// How often to auto-refresh orders while the dashboard is open (ms).
const POLL_INTERVAL_MS = 15000

// These match your actual OrderEntity.status values exactly.
// Note: there is no PENDING/CANCELLED status in your backend - every order
// starts as CONFIRMED, and the separate `paid` boolean tracks whether payment
// actually went through (shown as a badge below, not as a timeline stage).
const STATUSES = ['CONFIRMED', 'PACKED', 'SHIPPED', 'DELIVERED']

const STATUS_LABELS = {
  CONFIRMED: 'Confirmed',
  PACKED: 'Packed',
  SHIPPED: 'Shipped',
  DELIVERED: 'Delivered',
}

function formatMoney(paise) {
  return `₹${(paise / 100).toFixed(0)}`
}

function formatDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function AdminDashboard() {
  const [adminKey, setAdminKey] = useState(() => localStorage.getItem('drynut_admin_key') || '')
  const [keyInput, setKeyInput] = useState('')
  const [authError, setAuthError] = useState(null)

  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(false)
  const [isPolling, setIsPolling] = useState(false)
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [updatingId, setUpdatingId] = useState(null)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [selectedOrder, setSelectedOrder] = useState(null)

  // Track whether an update is in-flight so a background poll doesn't
  // clobber an optimistic UI change that hasn't been confirmed yet.
  const updatingIdRef = useRef(null)
  useEffect(() => {
    updatingIdRef.current = updatingId
  }, [updatingId])

  // silent = true means "background refresh" - don't show the big loading
  // state or blow away the screen, just quietly swap in fresh data.
  const fetchOrders = useCallback(async (key, { silent = false } = {}) => {
    if (silent) {
      setIsPolling(true)
    } else {
      setLoading(true)
      setLoadError(null)
    }
    try {
      // Your backend's /api/orders/summary endpoint returns { orders: [...] }
      // along with some aggregate counts, protected by the `key` query param.
      const res = await fetch(`${API_URL}/api/orders/summary?key=${encodeURIComponent(key)}`)
      if (res.status === 401 || res.status === 403) {
        setAuthError('Incorrect admin key.')
        localStorage.removeItem('drynut_admin_key')
        setAdminKey('')
        return
      }
      if (!res.ok) throw new Error('Could not load orders.')
      const data = await res.json()
      const nextOrders = Array.isArray(data.orders) ? data.orders : []

      // If a status update is mid-flight, keep that row's optimistic value
      // instead of letting a poll overwrite it before the PATCH resolves.
      const pendingId = updatingIdRef.current
      if (pendingId != null) {
        setOrders((current) => {
          const pendingOrder = current.find((o) => o.orderId === pendingId)
          return nextOrders.map((o) =>
            o.orderId === pendingId && pendingOrder ? { ...o, status: pendingOrder.status } : o
          )
        })
      } else {
        setOrders(nextOrders)
      }
      setLastUpdatedAt(new Date())
      if (!silent) setLoadError(null)
    } catch (err) {
      // Don't surface transient background-poll errors as a loud banner;
      // only report failures from an explicit/foreground load.
      if (!silent) setLoadError(err.message || 'Something went wrong loading orders.')
    } finally {
      if (silent) setIsPolling(false)
      else setLoading(false)
    }
  }, [])

  // Initial load whenever we (re)authenticate.
  useEffect(() => {
    if (adminKey) fetchOrders(adminKey)
  }, [adminKey, fetchOrders])

  // Background auto-polling while signed in. Pauses when the tab isn't
  // visible so we're not hammering the backend from a backgrounded tab.
  useEffect(() => {
    if (!adminKey) return

    const tick = () => {
      if (document.visibilityState === 'visible') {
        fetchOrders(adminKey, { silent: true })
      }
    }

    const intervalId = setInterval(tick, POLL_INTERVAL_MS)

    // Also refresh immediately whenever the tab regains focus/visibility,
    // so switching back to it shows current data right away.
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchOrders(adminKey, { silent: true })
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      clearInterval(intervalId)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [adminKey, fetchOrders])

  function handleLogin() {
    if (!keyInput.trim()) return
    setAuthError(null)
    localStorage.setItem('drynut_admin_key', keyInput.trim())
    setAdminKey(keyInput.trim())
  }

  function handleLogout() {
    localStorage.removeItem('drynut_admin_key')
    setAdminKey('')
    setOrders([])
    setLastUpdatedAt(null)
  }

  async function updateStatus(orderId, newStatus) {
    setUpdatingId(orderId)
    const prev = orders
    setOrders((list) => list.map((o) => (o.orderId === orderId ? { ...o, status: newStatus } : o)))
    try {
      // Your backend expects the admin key as a `key` query param, not a header,
      // and the new status in the JSON body.
      const res = await fetch(
        `${API_URL}/api/orders/${encodeURIComponent(orderId)}/status?key=${encodeURIComponent(adminKey)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus }),
        }
      )
      if (!res.ok) throw new Error('Update failed')
    } catch {
      setOrders(prev) // roll back on failure
      setLoadError('Could not update that order. Try again.')
    } finally {
      setUpdatingId(null)
    }
  }

  const filteredOrders = useMemo(() => {
    return orders
      .filter((o) => (statusFilter === 'ALL' ? true : o.status === statusFilter))
      .filter((o) => {
        if (!search.trim()) return true
        const q = search.trim().toLowerCase()
        return (
          (o.customerName || '').toLowerCase().includes(q) ||
          (o.customerPhone || '').includes(q) ||
          (o.pincode || '').includes(q) ||
          String(o.orderId || '').toLowerCase().includes(q)
        )
      })
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
  }, [orders, search, statusFilter])

  const stats = useMemo(() => {
    const paidOrders = orders.filter((o) => o.paid)
    const revenue = paidOrders.reduce((sum, o) => sum + (o.amountInPaise || 0), 0) / 100
    const unpaidCount = orders.filter((o) => !o.paid).length
    return {
      total: orders.length,
      paidCount: paidOrders.length,
      revenue,
      unpaidCount,
      todayCount: orders.filter((o) => {
        const d = new Date(o.createdAt)
        const now = new Date()
        return d.toDateString() === now.toDateString()
      }).length,
    }
  }, [orders])

  if (!adminKey) {
    return (
      <div className="admin-shell admin-login-shell">
        <div className="admin-login-card">
          <div className="admin-login-eyebrow">Drynut Admin</div>
          <h1 className="admin-login-title">Sign in to manage orders</h1>
          <p className="admin-login-sub">Enter the admin key configured on your backend (app.admin-key) to continue.</p>
          <input
            type="password"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            placeholder="Admin key"
            className="admin-login-input"
            autoFocus
          />
          <button className="admin-cta" onClick={handleLogin}>Sign in</button>
          {authError && <div className="admin-status admin-status-error">{authError}</div>}
        </div>
      </div>
    )
  }

  return (
    <div className="admin-shell">
      <header className="admin-header">
        <div>
          <div className="admin-eyebrow">Drynut Admin</div>
          <h1 className="admin-title">Orders</h1>
        </div>
        <div className="admin-header-actions">
          <div className="admin-live-status">
            <span className={`admin-live-dot ${isPolling ? 'pulsing' : ''}`} aria-hidden="true" />
            <span className="admin-live-text">
              {lastUpdatedAt
                ? `Updated ${lastUpdatedAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
                : 'Live'}
            </span>
          </div>
          <button className="admin-btn-ghost" onClick={() => fetchOrders(adminKey)} disabled={loading}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
          <button className="admin-btn-ghost admin-btn-logout" onClick={handleLogout}>Sign out</button>
        </div>
      </header>

      <section className="admin-stats">
        <div className="admin-stat-card">
          <span className="admin-stat-label">Total orders started</span>
          <span className="admin-stat-value">{stats.total}</span>
        </div>
        <div className="admin-stat-card admin-stat-accent-mint">
          <span className="admin-stat-label">Revenue collected</span>
          <span className="admin-stat-value">₹{stats.revenue.toFixed(0)}</span>
        </div>
        <div className="admin-stat-card admin-stat-accent-amber">
          <span className="admin-stat-label">Unpaid / abandoned</span>
          <span className="admin-stat-value">{stats.unpaidCount}</span>
        </div>
        <div className="admin-stat-card admin-stat-accent-rose">
          <span className="admin-stat-label">Orders today</span>
          <span className="admin-stat-value">{stats.todayCount}</span>
        </div>
      </section>

      <section className="admin-toolbar">
        <input
          className="admin-search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, phone, pincode or order ID"
        />
        <div className="admin-filter-pills">
          <button
            className={`admin-pill ${statusFilter === 'ALL' ? 'active' : ''}`}
            onClick={() => setStatusFilter('ALL')}
          >
            All
          </button>
          {STATUSES.map((s) => (
            <button
              key={s}
              className={`admin-pill ${statusFilter === s ? 'active' : ''}`}
              onClick={() => setStatusFilter(s)}
            >
              {STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      </section>

      {loadError && <div className="admin-status admin-status-error admin-status-banner">{loadError}</div>}

      {loading && orders.length === 0 ? (
        <div className="admin-empty">Loading orders…</div>
      ) : filteredOrders.length === 0 ? (
        <div className="admin-empty">
          <div className="admin-empty-title">No orders match this view</div>
          <div className="admin-empty-sub">Try a different filter or search term.</div>
        </div>
      ) : (
        <>
          {/* Table view - desktop/tablet */}
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Customer</th>
                  <th>Address</th>
                  <th>Qty</th>
                  <th>Amount</th>
                  <th>Paid</th>
                  <th>Status</th>
                  <th>Placed</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((o) => (
                  <tr key={o.orderId} onClick={() => setSelectedOrder(o)} className="admin-row">
                    <td className="admin-mono">{String(o.orderId).slice(-8)}</td>
                    <td>
                      <div className="admin-cell-title">{o.customerName}</div>
                      <div className="admin-cell-sub">{o.customerPhone}</div>
                    </td>
                    <td className="admin-cell-sub admin-address-cell">
                      {o.address}, {o.pincode}
                    </td>
                    <td>{o.quantity}</td>
                    <td className="admin-mono">{formatMoney(o.amountInPaise ?? 0)}</td>
                    <td>
                      <span className={`admin-paid-badge ${o.paid ? 'paid' : 'unpaid'}`}>
                        {o.paid ? 'Paid' : 'Unpaid'}
                      </span>
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <select
                        className={`admin-status-select admin-status-${(o.status || 'confirmed').toLowerCase()}`}
                        value={o.status}
                        disabled={updatingId === o.orderId || !o.paid}
                        onChange={(e) => updateStatus(o.orderId, e.target.value)}
                      >
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                        ))}
                      </select>
                    </td>
                    <td className="admin-cell-sub">{formatDate(o.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Card view - mobile */}
          <div className="admin-card-list">
            {filteredOrders.map((o) => (
              <div className="admin-order-card" key={o.orderId} onClick={() => setSelectedOrder(o)}>
                <div className="admin-order-card-top">
                  <div>
                    <div className="admin-cell-title">{o.customerName}</div>
                    <div className="admin-cell-sub">{o.customerPhone}</div>
                  </div>
                  <div className="admin-mono">{formatMoney(o.amountInPaise ?? 0)}</div>
                </div>
                <div className="admin-cell-sub admin-address-cell">{o.address}, {o.pincode}</div>
                <div className="admin-order-card-bottom">
                  <span className="admin-cell-sub">
                    {o.quantity} pack{o.quantity > 1 ? 's' : ''} · {formatDate(o.createdAt)} ·{' '}
                    <span className={`admin-paid-badge ${o.paid ? 'paid' : 'unpaid'}`}>
                      {o.paid ? 'Paid' : 'Unpaid'}
                    </span>
                  </span>
                  <select
                    className={`admin-status-select admin-status-${(o.status || 'confirmed').toLowerCase()}`}
                    value={o.status}
                    disabled={updatingId === o.orderId || !o.paid}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => updateStatus(o.orderId, e.target.value)}
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {selectedOrder && (
        <div className="admin-modal-backdrop" onClick={() => setSelectedOrder(null)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h2>Order {String(selectedOrder.orderId).slice(-8)}</h2>
              <button className="admin-modal-close" onClick={() => setSelectedOrder(null)} aria-label="Close">×</button>
            </div>
            <dl className="admin-modal-grid">
              <dt>Customer</dt><dd>{selectedOrder.customerName}</dd>
              <dt>Phone</dt><dd>{selectedOrder.customerPhone}</dd>
              <dt>Address</dt><dd>{selectedOrder.address}</dd>
              <dt>Pincode</dt><dd>{selectedOrder.pincode}</dd>
              <dt>Quantity</dt><dd>{selectedOrder.quantity} pack(s)</dd>
              <dt>Original amount</dt><dd>{formatMoney(selectedOrder.originalAmountInPaise ?? 0)}</dd>
              <dt>Discount</dt><dd>{formatMoney(selectedOrder.discountInPaise ?? 0)}</dd>
              <dt>Final amount</dt><dd>{formatMoney(selectedOrder.amountInPaise ?? 0)}</dd>
              <dt>Coupon</dt><dd>{selectedOrder.couponCode || '—'}</dd>
              <dt>Paid</dt><dd>{selectedOrder.paid ? 'Yes' : 'No'}</dd>
              <dt>Status</dt><dd>{STATUS_LABELS[selectedOrder.status] || selectedOrder.status}</dd>
              <dt>Placed</dt><dd>{formatDate(selectedOrder.createdAt)}</dd>
              <dt>Razorpay order ID</dt><dd className="admin-mono">{selectedOrder.orderId || '—'}</dd>
            </dl>
          </div>
        </div>
      )}
    </div>
  )
}
