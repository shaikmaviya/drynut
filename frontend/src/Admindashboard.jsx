import { useState, useEffect, useMemo } from 'react'

// Same backend used by the storefront.
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080'

// Statuses your backend should support. Adjust to match your actual order
// status enum in Spring Boot.
const STATUSES = ['PENDING', 'PAID', 'PACKED', 'SHIPPED', 'DELIVERED', 'CANCELLED']

const STATUS_LABELS = {
  PENDING: 'Pending',
  PAID: 'Paid',
  PACKED: 'Packed',
  SHIPPED: 'Shipped',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
}

function formatMoney(amountInPaiseOrRupees) {
  // Handles either paise (integer, large) or plain rupees depending on your API.
  const value = amountInPaiseOrRupees > 1000 ? amountInPaiseOrRupees / 100 : amountInPaiseOrRupees
  return `₹${value.toFixed(0)}`
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
  const [loadError, setLoadError] = useState(null)
  const [updatingId, setUpdatingId] = useState(null)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [selectedOrder, setSelectedOrder] = useState(null)

  async function fetchOrders(key) {
    setLoading(true)
    setLoadError(null)
    try {
      const res = await fetch(`${API_URL}/api/admin/orders`, {
        headers: { 'x-admin-key': key },
      })
      if (res.status === 401 || res.status === 403) {
        setAuthError('Incorrect admin key.')
        localStorage.removeItem('drynut_admin_key')
        setAdminKey('')
        return
      }
      if (!res.ok) throw new Error('Could not load orders.')
      const data = await res.json()
      setOrders(Array.isArray(data) ? data : data.orders || [])
    } catch (err) {
      setLoadError(err.message || 'Something went wrong loading orders.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (adminKey) fetchOrders(adminKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminKey])

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
  }

  async function updateStatus(orderId, newStatus) {
    setUpdatingId(orderId)
    const prev = orders
    setOrders((list) => list.map((o) => (o.orderId === orderId ? { ...o, status: newStatus } : o)))
    try {
      const res = await fetch(`${API_URL}/api/admin/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': adminKey },
        body: JSON.stringify({ status: newStatus }),
      })
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
    const paidOrders = orders.filter((o) => o.status !== 'CANCELLED' && o.status !== 'PENDING')
    const revenue = paidOrders.reduce((sum, o) => sum + (o.amountInPaise ? o.amountInPaise / 100 : o.amount || 0), 0)
    const pendingCount = orders.filter((o) => o.status === 'PENDING').length
    return {
      total: orders.length,
      revenue,
      pendingCount,
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
          <p className="admin-login-sub">Enter the admin key configured on your backend to continue.</p>
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
          <button className="admin-btn-ghost" onClick={() => fetchOrders(adminKey)} disabled={loading}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
          <button className="admin-btn-ghost admin-btn-logout" onClick={handleLogout}>Sign out</button>
        </div>
      </header>

      <section className="admin-stats">
        <div className="admin-stat-card">
          <span className="admin-stat-label">Total orders</span>
          <span className="admin-stat-value">{stats.total}</span>
        </div>
        <div className="admin-stat-card admin-stat-accent-mint">
          <span className="admin-stat-label">Revenue collected</span>
          <span className="admin-stat-value">₹{stats.revenue.toFixed(0)}</span>
        </div>
        <div className="admin-stat-card admin-stat-accent-amber">
          <span className="admin-stat-label">Pending</span>
          <span className="admin-stat-value">{stats.pendingCount}</span>
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
                    <td className="admin-mono">{formatMoney(o.amountInPaise ?? o.amount ?? 0)}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <select
                        className={`admin-status-select admin-status-${(o.status || 'pending').toLowerCase()}`}
                        value={o.status}
                        disabled={updatingId === o.orderId}
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
                  <div className="admin-mono">{formatMoney(o.amountInPaise ?? o.amount ?? 0)}</div>
                </div>
                <div className="admin-cell-sub admin-address-cell">{o.address}, {o.pincode}</div>
                <div className="admin-order-card-bottom">
                  <span className="admin-cell-sub">{o.quantity} pack{o.quantity > 1 ? 's' : ''} · {formatDate(o.createdAt)}</span>
                  <select
                    className={`admin-status-select admin-status-${(o.status || 'pending').toLowerCase()}`}
                    value={o.status}
                    disabled={updatingId === o.orderId}
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
              <dt>Amount</dt><dd>{formatMoney(selectedOrder.amountInPaise ?? selectedOrder.amount ?? 0)}</dd>
              <dt>Coupon</dt><dd>{selectedOrder.couponCode || '—'}</dd>
              <dt>Status</dt><dd>{STATUS_LABELS[selectedOrder.status] || selectedOrder.status}</dd>
              <dt>Placed</dt><dd>{formatDate(selectedOrder.createdAt)}</dd>
              <dt>Razorpay order</dt><dd className="admin-mono">{selectedOrder.razorpayOrderId || '—'}</dd>
              <dt>Razorpay payment</dt><dd className="admin-mono">{selectedOrder.razorpayPaymentId || '—'}</dd>
            </dl>
          </div>
        </div>
      )}
    </div>
  )
}
