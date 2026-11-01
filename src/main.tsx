import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/noto-sans-georgian/400.css'
import '@fontsource/noto-sans-georgian/500.css'
import '@fontsource/noto-sans-georgian/600.css'
import '@fontsource/noto-sans-georgian/700.css'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
