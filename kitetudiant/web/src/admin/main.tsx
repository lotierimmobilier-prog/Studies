import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { Console } from './Console.tsx'
import '../styles.css'
import './admin.css'

const racine = document.getElementById('root')
if (racine) createRoot(racine).render(<StrictMode><Console /></StrictMode>)
