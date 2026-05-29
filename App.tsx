import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
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
import { Contribute } from './components/Contribute';
import { ResolverPage } from './components/ResolverPage';
import { TrocadorSwap } from './components/TrocadorSwap';
import { SwapCheckout } from './components/SwapCheckout';
import { PaymentPage } from './components/PaymentPage';
import { OrderTracker, OrdersList } from './components/OrderTracker';
import { MarketPage } from './components/MarketPage';
import { DonationGoal } from './components/DonationGoal';
import { TermsPage } from './components/TermsPage';
import { PrivacyPage } from './components/PrivacyPage';
import { PrivacyNotice } from './components/PrivacyNotice';
import { StatusPage } from './components/StatusPage';

const MainLayout: React.FC<{
    isLoggedIn: boolean;
    username: string | null;
    setIsLoginOpen: (v: boolean) => void;
    setIsRegisterOpen: (v: boolean) => void;
    handleLogout: () => void;
    theme: 'light' | 'dark';
    toggleTheme: () => void;
    activeSection: 'home' | 'learn' | 'guide' | 'tools' | 'contribute' | 'swap' | 'shop' | 'activity';
    setActiveSection: (section: 'home' | 'learn' | 'guide' | 'tools' | 'contribute' | 'swap' | 'shop' | 'activity') => void;
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
            {/* Hidden mount listens for the global goxmr:support:open event so the donation modal
                works from the header dropdown on every page, not just the homepage. */}
            <DonationGoal hidden />
            {/* First-visit transparency banner. Auto-hides once acknowledged for the
                current PRIVACY_VERSION; a material policy change re-surfaces it. */}
            <PrivacyNotice />
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
    const [isMigrationOpen, setIsMigrationOpen] = useState(false);
    const [initialRegisterUsername, setInitialRegisterUsername] = useState('');
    // #9: derive activeSection from the URL hash so browser back/forward toggles dashboard sub-pages.
    // The hash is the single source of truth; setActiveSection writes to it via navigate().
    type Section = 'home' | 'learn' | 'guide' | 'tools' | 'contribute' | 'swap' | 'shop' | 'activity';
    const validSections: Section[] = ['home', 'learn', 'guide', 'tools', 'contribute', 'swap', 'shop', 'activity'];
    const location = useLocation();
    const navigate = useNavigate();
    const hash = (location.hash || '').replace(/^#/, '').toLowerCase();
    const activeSection: Section = (validSections.includes(hash as Section) ? (hash as Section) : 'home');
    const setActiveSection = (s: Section) => {
        // #9: write the hash so back/forward toggles tabs. If we're not already on /dashboard,
        // route there now (header may have fired this from the landing page).
        const onDashboardPath = location.pathname === '/dashboard';
        const targetPath = onDashboardPath ? location.pathname : '/dashboard';
        if (s === 'home') navigate({ pathname: targetPath, hash: '' });
        else navigate({ pathname: targetPath, hash: '#' + s });
    };

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
        if (!localStorage.getItem('goxmr_migration_notice_v1')) {
            setIsMigrationOpen(true);
        }
    }, []);

    const dismissMigrationNotice = () => {
        localStorage.setItem('goxmr_migration_notice_v1', '1');
        setIsMigrationOpen(false);
    };

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

    // Terminal can fire this to toggle theme without prop-drilling
    useEffect(() => {
        const h = () => toggleTheme();
        window.addEventListener('goxmr:theme:toggle', h);
        return () => window.removeEventListener('goxmr:theme:toggle', h);
    }, []);

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

        // Handle post-auth redirect (e.g. from shop checkout)
        const intent = localStorage.getItem('checkout_intent');
        if (intent) {
            try {
                const { return_to } = JSON.parse(intent);
                localStorage.removeItem('checkout_intent');
                // Only allow relative paths to prevent open redirect
                if (return_to && typeof return_to === 'string' && return_to.startsWith('/') && !return_to.startsWith('//')) {
                    window.location.href = return_to;
                }
            } catch {
                localStorage.removeItem('checkout_intent');
            }
        } else {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
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
                    <Route path="/" element={<LandingPage onOpenRegister={handleOpenRegister} />} />
                    <Route path="/dashboard" element={(() => {
                        // Public sections (learn/guide/tools/contribute/swap/shop/activity) don't require auth.
                        // Only the bare "home" section maps to <Dashboard /> which is auth-only.
                        const PUBLIC_SECTIONS: Array<typeof activeSection> = ['learn', 'guide', 'tools', 'contribute', 'swap', 'shop', 'activity'];
                        if (activeSection === 'learn') return <LearnMonero />;
                        if (activeSection === 'guide') return <Guide />;
                        if (activeSection === 'tools') return <Tools />;
                        if (activeSection === 'contribute') return <Contribute />;
                        if (PUBLIC_SECTIONS.includes(activeSection)) return <TrocadorSwap />;
                        return isLoggedIn ? <Dashboard /> : <Navigate to="/" />;
                    })()} />
                    <Route path="/checkout/:tradeId" element={<SwapCheckout />} />
                    <Route path="/Dashboard" element={<Navigate to="/dashboard" replace />} />
                    <Route path="/terms" element={<TermsPage />} />
                    <Route path="/privacy" element={<PrivacyPage />} />
                    <Route path="/status" element={<StatusPage />} />


                </Route>

                {/* Specific routes - MUST be before /:username catch-all */}
                <Route path="/s/:code" element={<ResolverPage mode="signal" />} />
                <Route path="/d/:code" element={<ResolverPage mode="drop" />} />
                <Route path="/pay/:username" element={<PaymentPage />} />
                {/* #4.1: public stateless order tracker + local-only "my orders" list */}
                <Route path="/track/:orderCode" element={<OrderTracker />} />
                <Route path="/orders" element={<OrdersList />} />
                {/* #4.4: opt-in marketplace discovery */}
                <Route path="/market" element={<MarketPage />} />

                {/* #7: per-seller store routes — shareable storefront and individual product URLs */}
                <Route path="/:username/store" element={
                    <div className="light font-sans selection:bg-monero-orange selection:text-white relative min-h-screen">
                        <PublicProfile />
                    </div>
                } />
                <Route path="/:username/store/:productSlug" element={
                    <div className="light font-sans selection:bg-monero-orange selection:text-white relative min-h-screen">
                        <PublicProfile />
                    </div>
                } />

                {/* Public Profile - catch-all, MUST be last */}
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
            <Modal isOpen={isMigrationOpen} onClose={dismissMigrationNotice} title="WE'RE MIGRATING">
                <div className="space-y-4 text-sm leading-relaxed">
                    <p className="text-monero-orange font-black uppercase tracking-tight">Thanks to your donations, GOXMR is leveling up.</p>
                    <p className="dark:text-gray-300">
                        We're moving the whole platform to a dedicated VPS for better speed, uptime and privacy.
                        The community's contributions are what make this possible. Thank you.
                    </p>
                    <p className="text-xs text-gray-500">
                        Payments always go directly to each seller's own wallet. GOXMR never touches funds.
                    </p>
                    <button
                        onClick={dismissMigrationNotice}
                        className="bg-black dark:bg-white text-white dark:text-black font-mono text-xs font-black uppercase px-6 py-3 border-2 border-black dark:border-white shadow-[4px_4px_0px_0px_rgba(242,104,34,1)] hover:bg-monero-orange hover:text-white transition-colors"
                    >
                        Got it
                    </button>
                </div>
            </Modal>
        </div>
    );
};

export default App;