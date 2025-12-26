import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { Dashboard } from './components/Dashboard';
import { LandingPage } from './components/LandingPage';
import { PublicProfile } from './components/PublicProfile';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { Background } from './components/Background';
import { Modal } from './components/Modal';
import { LoginForm, RegisterForm } from './components/AuthForms';
const App: React.FC = () => {
    const [isLoggedIn, setUserLoggedIn] = useState(false);
    const [username, setUsername] = useState<string | null>(null);

    const [isLoginOpen, setIsLoginOpen] = useState(false);
    const [isRegisterOpen, setIsRegisterOpen] = useState(false);
    const [initialRegisterUsername, setInitialRegisterUsername] = useState('');

    const [theme, setTheme] = useState<'light' | 'dark'>(() => {
        const saved = localStorage.getItem('goxmr_theme');
        return (saved as 'light' | 'dark') || 'light';
    });

    useEffect(() => {
        const token = localStorage.getItem('goxmr_token');
        const savedUser = localStorage.getItem('goxmr_user');
        if (token) {
            setUserLoggedIn(true);
            if (savedUser) setUsername(savedUser);
        }
    }, []);

    useEffect(() => {
        localStorage.setItem('goxmr_theme', theme);
    }, [theme]);

    const toggleTheme = () => {
        setTheme(prev => prev === 'light' ? 'dark' : 'light');
    };

    const handleOpenRegister = (username?: string) => {
        if (username) setInitialRegisterUsername(username);
        setIsRegisterOpen(true);
    };
    const handleAuthSuccess = () => {
        setIsLoginOpen(false);
        setIsRegisterOpen(false);
        setUserLoggedIn(true);
        const savedUser = localStorage.getItem('goxmr_user');
        if (savedUser) setUsername(savedUser);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    const handleLogout = () => {
        localStorage.removeItem('goxmr_token');
        localStorage.removeItem('goxmr_user');
        setUserLoggedIn(false);
        setUsername(null);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const AppLayout = ({ children }: { children: React.ReactNode }) => (
        <div className={`${theme === 'dark' ? 'dark' : ''} h-full`}>
            <div className="min-h-screen bg-white transition-colors duration-300 dark:bg-[#000000] text-black dark:text-white font-sans selection:bg-monero-orange selection:text-white relative">
                <Background />
                {children}
            </div>
        </div>
    );

    const MainLayout = () => (
        <>
            <Header
                isLoggedIn={isLoggedIn}
                username={username || ''}
                onLoginClick={() => setIsLoginOpen(true)}
                onRegisterClick={() => setIsRegisterOpen(true)}
                onLogoutClick={handleLogout}
                theme={theme}
                onThemeToggle={toggleTheme}
            />
            <main className="relative z-10 pt-20 pb-12 min-h-screen">
                <Outlet />
            </main>
            <Footer />
        </>
    );

    return (
        <div className={theme === 'dark' ? 'dark' : ''}>
            <Routes>
                {/* Routes with Header & Footer and Dark Mode support */}
                <Route element={<AppLayout><MainLayout /></AppLayout>}>
                    <Route path="/" element={
                        isLoggedIn ? <Navigate to="/dashboard" /> : <LandingPage onOpenRegister={handleOpenRegister} />
                    } />
                    <Route path="/dashboard" element={
                        isLoggedIn ? <Dashboard /> : <Navigate to="/" />
                    } />
                </Route>

                {/* Public Profile (No Header/Footer, No Dark Mode) */}
                <Route path="/:username" element={
                    <div className="light font-sans selection:bg-monero-orange selection:text-white relative min-h-screen">
                        <PublicProfile />
                    </div>
                } />
            </Routes>

            {/* Global Modals - Now inside the theme-controlled div */}
            <Modal isOpen={isLoginOpen} onClose={() => setIsLoginOpen(false)} title="AUTHENTICATE">
                <LoginForm onSuccess={handleAuthSuccess} />
            </Modal>
            <Modal isOpen={isRegisterOpen} onClose={() => setIsRegisterOpen(false)} title="CREATE IDENTITY">
                <RegisterForm onSuccess={handleAuthSuccess} initialUsername={initialRegisterUsername} />
            </Modal>
        </div>
    );
};
export default App;