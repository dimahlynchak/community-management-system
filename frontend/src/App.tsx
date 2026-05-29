import { Route, Routes } from 'react-router-dom';
import ProtectedRoute from './auth/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import Home from './pages/Home';
import Profile from './pages/Profile';
import CommunitiesList from './pages/communities/CommunitiesList';
import CommunityDetail from './pages/communities/CommunityDetail';
import UnitsList from './pages/communities/UnitsList';
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
                <Route path="/profile" element={<Profile />} />
                <Route path="/communities" element={<CommunitiesList />} />
                <Route path="/communities/:id" element={<CommunityDetail />} />
                <Route path="/communities/:id/units" element={<UnitsList />} />
                <Route path="*" element={<NotFound />} />
            </Route>
        </Routes>
    );
}