import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

if (window.location.pathname === '/') {
  window.location.replace('/landing.html')
} else {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
}
