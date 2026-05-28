import { Routes, Route } from 'react-router-dom';
import { Building2 } from 'lucide-react';

export default function App() {
  return (
      <Routes>
        <Route path="*" element={<Home />} />
      </Routes>
  );
}

function Home() {
  return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="card max-w-md w-full mx-4">
          <div className="card-body text-center space-y-3">
            <Building2 className="text-brand-600 mx-auto" size={40} />
            <h1 className="text-2xl font-semibold text-slate-900">
              ОСББ — система управління
            </h1>
          </div>
        </div>
      </div>
  );
}