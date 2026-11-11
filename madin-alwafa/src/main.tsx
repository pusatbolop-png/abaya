import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/huruf.css';
import './styles/tokens.css';
import './styles/dasar.css';
import './styles/komponen.css';
import './styles/tata-letak.css';
import './styles/halaman.css';
import './styles/raport.css';
import './styles/kartu.css';
import { Aplikasi } from './rute';

createRoot(document.getElementById('akar')!).render(
  <StrictMode>
    <Aplikasi />
  </StrictMode>,
);
