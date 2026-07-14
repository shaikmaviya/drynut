import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import Admindashboard from './Admindashboard.jsx'
import './Admindashboard.css'

const isAdmin = window.location.pathname.startsWith('/admin')

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {isAdmin ? <Admindashboard /> : <App />}
  </React.StrictMode>,
)