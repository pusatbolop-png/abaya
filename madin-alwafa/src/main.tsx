import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/plus-jakarta-sans';
import '@fontsource/cormorant-garamond/500.css';
import '@fontsource/cormorant-garamond/600.css';
import '@fontsource/cormorant-garamond/700.css';
import '@fontsource/amiri/400.css';
import '@fontsource/amiri/700.css';
import './styles/tokens.css';
import './styles/dasar.css';
import './styles/komponen.css';
import './styles/tata-letak.css';
import './styles/halaman.css';
import './styles/raport.css';
import { Aplikasi } from './rute';

createRoot(document.getElementById('akar')!).render(
  <StrictMode>
    <Aplikasi />
  </StrictMode>,
);
