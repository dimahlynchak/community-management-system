import { Route, Routes } from 'react-router-dom';
import ProtectedRoute from './auth/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import Home from './pages/Home';
import NotFound from './pages/NotFound';

export default function App() {
    return (
        <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route
                element={
                    <ProtectedRoute>
                        <Layout />
                    </ProtectedRoute>
                }
            >
                <Route path="/" element={<Home />} />
                <Route path="/communities" element={<CommunitiesPlaceholder />} />
                <Route path="*" element={<NotFound />} />
            </Route>
        </Routes>
    );
}

function CommunitiesPlaceholder() {
    return (
        <div className="card max-w-2xl">
            <div className="card-body space-y-2">
                <h2 className="text-lg font-semibold text-slate-900">Спільноти</h2>
                <p className="text-sm text-slate-600">
                    Розділ реалізується наступним кроком розробки.
                </p>
            </div>
        </div>
    );
}