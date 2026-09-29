import { useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from '@/pages/Home';
import Login from '@/pages/Login';
import Onboarding from '@/pages/Onboarding';
import { loadFarmProfile } from '@/lib/localStore';

function Startup() {
  const [needsSetup, setNeedsSetup] = useState(() => !loadFarmProfile());

  return needsSetup ? <Onboarding onComplete={() => setNeedsSetup(false)} /> : <Home />;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Startup />} />
        <Route path="/login" element={<Login />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
