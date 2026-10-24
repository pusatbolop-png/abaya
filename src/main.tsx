import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import './styles/tokens.css';
import './styles/dasar.css';
import './styles/komponen.css';
import './styles/tata-letak.css';
import './styles/halaman.css';
import { router } from './rute';
import { PenyediaInfo, PenyediaSesi, PenyediaToast } from './lib/konteks';

createRoot(document.getElementById('akar')!).render(
  <StrictMode>
    <PenyediaInfo>
      <PenyediaSesi>
        <PenyediaToast>
          <RouterProvider router={router} />
        </PenyediaToast>
      </PenyediaSesi>
    </PenyediaInfo>
  </StrictMode>,
);
