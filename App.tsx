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
import { Guide } from './components/Guide';
import { LearnMonero } from './components/LearnMonero';
import { Tools } from './components/Tools';
import { ResolverPage } from './components/ResolverPage';

const MainLayout: React.FC<{
    isLoggedIn: boolean;
    username: string | null;
    setIsLoginOpen: (v: boolean) => void;
    setIsRegisterOpen: (v: boolean) => void;
    handleLogout: () => void;
    theme: 'light' | 'dark';
    toggleTheme: () => void;
    activeSection: 'home' | 'learn' | 'guide' | 'tools';
    setActiveSection: (section: 'home' | 'learn' | 'guide' | 'tools') => void;
}> = ({ isLoggedIn, username, setIsLoginOpen, setIsRegisterOpen, handleLogout, theme, toggleTheme, activeSection, setActiveSection }) => {
    return (
        <div className="min-h-screen flex flex-col pt-16 md:pt-20">
            <Header
                isLoggedIn={isLoggedIn}
                username={username || ''}
                onLoginClick={() => setIsLoginOpen(true)}
                onRegisterClick={() => setIsRegisterOpen(true)}
                onLogoutClick={handleLogout}
                theme={theme}
                onThemeToggle={toggleTheme}
                activeSection={activeSection}
                onNavigate={setActiveSection}
            />
            <main className="flex-grow">
                <Outlet context={{ activeSection, setActiveSection }} />
            </main>
            <Footer />
        </div>
    );
};

const AppLayout: React.FC<{ children: React.ReactNode, theme: string }> = ({ children, theme }) => (
    <div className={`${theme === 'dark' ? 'dark' : ''} h-full`}>
        <div className="min-h-screen bg-white transition-colors duration-300 dark:bg-[#000000] text-black dark:text-white font-sans selection:bg-monero-orange selection:text-white relative">
            <Background />
            {children}
        </div>
    </div>
);

const App: React.FC = () => {
    const [isLoggedIn, setUserLoggedIn] = useState(false);
    const [username, setUsername] = useState<string | null>(null);

    const [isLoginOpen, setIsLoginOpen] = useState(false);
    const [isRegisterOpen, setIsRegisterOpen] = useState(false);
    const [initialRegisterUsername, setInitialRegisterUsername] = useState('');
    const [activeSection, setActiveSection] = useState<'home' | 'learn' | 'guide' | 'tools'>('home');

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
        if (theme === 'dark') {
            document.body.classList.add('dark');
        } else {
            document.body.classList.remove('dark');
        }
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



    return (
        <div className={theme === 'dark' ? 'dark' : ''}>
            <Routes>
                {/* Routes with Header & Footer and Dark Mode support */}
                <Route element={
                    <AppLayout theme={theme}>
                        <MainLayout
                            isLoggedIn={isLoggedIn}
                            username={username}
                            setIsLoginOpen={setIsLoginOpen}
                            setIsRegisterOpen={setIsRegisterOpen}
                            handleLogout={handleLogout}
                            theme={theme}
                            toggleTheme={toggleTheme}
                            activeSection={activeSection}
                            setActiveSection={setActiveSection}
                        />
                    </AppLayout>
                }>
                    <Route path="/" element={
                        <LandingPage onOpenRegister={handleOpenRegister} />
                    } />
                    <Route path="/dashboard" element={
                        isLoggedIn ? (
                            activeSection === 'learn' ? <LearnMonero /> :
                                activeSection === 'guide' ? <Guide /> :
                                    activeSection === 'tools' ? <Tools /> :
                                        <Dashboard />
                        ) : <Navigate to="/" />
                    } />
                    <Route path="/Dashboard" element={<Navigate to="/dashboard" replace />} />
                </Route>

                {/* Public Profile (No Header/Footer, No Global Dark Mode) */}
                <Route path="/:username" element={
                    <div className="light font-sans selection:bg-monero-orange selection:text-white relative min-h-screen">
                        <PublicProfile />
                    </div>
                } />

                {/* Signals & Drops Resolvers */}
                <Route path="/s/:code" element={<ResolverPage mode="signal" />} />
                <Route path="/d/:code" element={<ResolverPage mode="drop" />} />
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