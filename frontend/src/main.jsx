import React from 'react'
import ReactDOM from 'react-dom/client'
import axios from 'axios'
import App from './App.jsx'
import './index.css'

const apiBaseUrl = localStorage.getItem('naatal_api_url') || import.meta.env.VITE_API_BASE_URL || ''
if (apiBaseUrl) {
  axios.defaults.baseURL = apiBaseUrl
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
