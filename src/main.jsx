// Punto de entrada de la aplicación React
// Monta el componente raíz <App /> dentro del elemento con id="root" del HTML
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// StrictMode activa advertencias adicionales de React en desarrollo (no afecta producción)
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
