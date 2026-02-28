"use client";

import React, { useState, useEffect } from "react";
import { MAX_EMAIL, MAX_PASSWORD, MAX_NAME } from "@/lib/constants/validation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { Eye, EyeOff } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import Image from "next/image";

type Props = {
    onNavigateToPasswordReset: () => void;
};

export default function PremiumLoginCard({ onNavigateToPasswordReset }: Props) {
    const { t } = useTranslation();
    const [isLogin, setIsLogin] = useState(true);

    // Login state
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [emailError, setEmailError] = useState("");
    const [passwordError, setPasswordError] = useState("");
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");
    const [socialLoading, setSocialLoading] = useState<'google' | 'facebook' | null>(null);

    // Register state
    const [fullName, setFullName] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [nameError, setNameError] = useState("");
    const [passwordMatchError, setPasswordMatchError] = useState(false);
    const [successMsg, setSuccessMsg] = useState("");
    const [passwordStrength, setPasswordStrength] = useState<"none" | "low" | "medium" | "strong" | "very-strong">("none");

    // Detectar si el usuario llega con tokens de OAuth (hash fragment o sesión activa)
    useEffect(() => {
        const handleOAuthReturn = async () => {
            try {
                const supabase = getSupabaseBrowserClient();

                // Verificar si hay hash con access_token (flujo implícito)
                const hash = window.location.hash;
                if (!hash || !hash.includes('access_token')) return;

                // Supabase auto-detecta y procesa los tokens del hash
                const { data: { session }, error } = await supabase.auth.getSession();

                if (error || !session?.user) return;

                const userId = session.user.id;
                const userFullName = session.user.user_metadata?.full_name || session.user.user_metadata?.name || '';

                // Verificar/asignar userlevel
                const { data: existingLevel } = await supabase
                    .from('userlevel')
                    .select('user_level')
                    .eq('id', userId)
                    .maybeSingle();

                const alreadyHasLevel = !!(existingLevel?.user_level && existingLevel.user_level.trim() !== '');

                if (!alreadyHasLevel) {
                    // Asignar nivel Client via API
                    await fetch('/api/auth/after-signup', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ userId, userLevel: 'Client' }),
                    }).catch(() => { });

                    // Insertar en clients
                    try {
                        await supabase
                            .from('clients')
                            .insert([{ user_id: userId, name: userFullName || session.user.email || '' }]);
                    } catch { /* ignorar error si ya existe */ }
                }

                // Obtener nivel para redirect
                const { data: ul } = await supabase
                    .from('userlevel')
                    .select('user_level')
                    .eq('id', userId)
                    .maybeSingle();

                const normalized = (ul?.user_level ?? '').toString().trim().toLowerCase();

                let role = '';
                let redirectPath = '/gestion';

                if (['cliente', 'client'].includes(normalized)) { role = 'client'; redirectPath = '/cliente'; }
                else if (['vzla', 'venezuela'].includes(normalized)) { role = 'venezuela'; redirectPath = '/venezuela'; }
                else if (['china'].includes(normalized)) { role = 'china'; redirectPath = '/china'; }
                else if (['pagos', 'payments', 'payment', 'validador', 'validator'].includes(normalized)) { role = 'pagos'; redirectPath = '/pagos'; }
                else if (['admin', 'administrador', 'administrator'].includes(normalized)) { role = 'admin'; redirectPath = '/admin'; }

                if (role) {
                    document.cookie = `role=${role}; Path=/; Max-Age=${60 * 60 * 12}; SameSite=Lax`;
                }

                localStorage.setItem('currentUserId', userId);
                window.location.href = redirectPath;
            } catch (err) {
                console.error('Error procesando OAuth return:', err);
            }
        };

        handleOAuthReturn();
    }, []);

    const validateEmail = (value: string) => {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    };

    const getPasswordStrengthInfo = (pwd: string): { text: string; level: typeof passwordStrength } => {
        let strength = 0;
        let text = "";
        let level: typeof passwordStrength = "none";

        if (pwd.length === 0) return { text: "", level: "none" };

        strength = 1;
        if (pwd.length >= 6) strength++;
        if (pwd.length >= 8 && /[A-Z]/.test(pwd)) strength++;
        if (pwd.length >= 10 && /[0-9]/.test(pwd)) strength++;
        if (pwd.length >= 12 && /[^A-Za-z0-9]/.test(pwd)) strength++;

        if (strength === 1) {
            text = t('auth.common.passwordLevelLow');
            level = "low";
        } else if (strength === 2) {
            text = t('auth.common.passwordLevelMedium');
            level = "medium";
        } else if (strength === 3) {
            text = t('auth.common.passwordLevelStrong');
            level = "strong";
        } else if (strength >= 4) {
            text = t('auth.common.passwordLevelVeryStrong');
            level = "very-strong";
        }

        return { text, level };
    };

    const handlePasswordChange = (value: string) => {
        setPassword(value);
        const { level } = getPasswordStrengthInfo(value);
        setPasswordStrength(level);

        if (confirmPassword.length > 0) {
            setPasswordMatchError(value !== confirmPassword);
        }
    };

    // LOGIN HANDLER - Lógica existente
    const handleLogin = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
        e.preventDefault();
        setErrorMsg("");
        let valid = true;

        if (!email) {
            setEmailError(t('auth.common.emailRequired'));
            valid = false;
        } else if (!validateEmail(email)) {
            setEmailError(t('auth.common.invalidEmail'));
            valid = false;
        } else {
            setEmailError("");
        }

        if (!password) {
            setPasswordError(t('auth.common.passwordRequired'));
            valid = false;
        } else {
            setPasswordError("");
        }

        if (!valid) {
            if (!errorMsg) setErrorMsg(t('auth.login.fieldsRequired'));
            return;
        }

        setLoading(true);
        try {
            const supabase = getSupabaseBrowserClient();
            const { data, error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) throw error;

            const userId = data?.user?.id;
            if (userId) {
                localStorage.setItem('currentUserId', userId);
            }

            if (userId) {
                try {
                    const { data: existingLevel, error: existingErr } = await supabase
                        .from("userlevel")
                        .select("user_level")
                        .eq("id", userId)
                        .maybeSingle();
                    if (existingErr) {
                        console.warn("Error consultando userlevel previo:", existingErr.message);
                    }
                    const alreadyHasLevel = !!(existingLevel?.user_level && existingLevel.user_level.trim() !== "");
                    if (!alreadyHasLevel) {
                        const res = await fetch("/api/auth/after-signup", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ userId, userLevel: "Client" }),
                        });
                        if (!res.ok) {
                            const payload = await res.json().catch(() => ({}));
                            console.warn("after-signup error:", payload?.error);
                        }
                    }
                } catch (e) {
                    console.warn("after-signup verificación falló", e);
                }
            }

            let normalized = "";
            if (userId) {
                const { data: ul, error: ulError } = await supabase
                    .from("userlevel")
                    .select("user_level")
                    .eq("id", userId)
                    .maybeSingle();
                if (ulError) {
                    console.warn("Error consultando userlevel:", ulError.message);
                }
                const level = (ul?.user_level ?? "").toString();
                normalized = level.trim().toLowerCase();
            }

            const isClient = ["cliente", "client"].includes(normalized);
            const isVzla = ["vzla", "venezuela"].includes(normalized);
            const isChina = ["china"].includes(normalized);
            const isAdmin = ["admin", "administrador", "administrator"].includes(normalized);
            const isPagos = ["pagos", "payments", "payment", "validador", "validator"].includes(normalized);

            try {
                const roleForCookie = isClient
                    ? 'client'
                    : isVzla
                        ? 'venezuela'
                        : isChina
                            ? 'china'
                            : isPagos
                                ? 'pagos'
                                : isAdmin
                                    ? 'admin'
                                    : '';
                if (roleForCookie) {
                    document.cookie = `role=${roleForCookie}; Path=/; Max-Age=${60 * 60 * 12}; SameSite=Lax`;
                } else {
                    document.cookie = 'role=; Path=/; Max-Age=0; SameSite=Lax';
                }
            } catch (e) {
                console.warn('No se pudo setear cookie de rol', e);
            }

            if (isClient) window.location.href = '/cliente';
            else if (isVzla) window.location.href = '/venezuela';
            else if (isChina) window.location.href = '/china';
            else if (isPagos) window.location.href = '/pagos';
            else if (isAdmin) window.location.href = '/admin';
            else window.location.href = '/gestion';
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            setErrorMsg(message || t('auth.login.errorFallback'));
        } finally {
            setLoading(false);
        }
    };

    // REGISTER HANDLER - Lógica existente
    const handleRegister = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
        e.preventDefault();
        let valid = true;
        setNameError("");
        setEmailError("");

        if (!fullName.trim()) {
            setNameError(t('auth.common.nameRequired'));
            valid = false;
        } else if (fullName.trim().length < 3 || !/^[A-Za-zÁÉÍÓÚáéíóúÑñ ]+$/.test(fullName.trim())) {
            setNameError(t('auth.common.nameInvalid'));
            valid = false;
        }

        if (!email.trim()) {
            setEmailError(t('auth.common.emailRequired'));
            valid = false;
        } else if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
            setEmailError(t('auth.common.invalidEmailAlt'));
            valid = false;
        }

        if (!password) {
            valid = false;
        }
        if (password !== confirmPassword) {
            setPasswordMatchError(true);
            valid = false;
        }
        if (passwordStrength === "low" || passwordStrength === "none") {
            valid = false;
        }
        if (!valid) {
            if (!errorMsg) setErrorMsg(t('auth.register.fieldsRequired'));
            return;
        }
        setPasswordMatchError(false);

        try {
            setLoading(true);
            setErrorMsg("");
            setSuccessMsg("");
            const supabase = getSupabaseBrowserClient();
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: { full_name: fullName },
                    emailRedirectTo: process.env.NEXT_PUBLIC_SITE_URL
                        ? `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`
                        : undefined,
                },
            });
            if (error) throw error;

            const userId = data?.user?.id;
            if (userId) {
                const { error: clientError } = await supabase
                    .from('clients')
                    .insert([
                        {
                            user_id: userId,
                            name: fullName
                        }
                    ]);
                if (clientError) {
                    console.warn('Error insertando en clients:', clientError.message);
                }

                try {
                    const res = await fetch("/api/auth/after-signup", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ userId, userLevel: "Client" }),
                    });
                    if (!res.ok) {
                        const payload = await res.json().catch(() => ({}));
                        console.warn("after-signup error:", payload?.error);
                    }
                } catch (e) {
                    console.warn("after-signup fetch failed", e);
                }
            }
            setSuccessMsg(t('auth.register.success'));
            setFullName("");
            setEmail("");
            setPassword("");
            setConfirmPassword("");
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            setErrorMsg(message || t('auth.register.errorFallback'));
        } finally {
            setLoading(false);
        }
    };

    const handleForgotPassword = (e: React.MouseEvent<HTMLAnchorElement>): void => {
        e.preventDefault();
        onNavigateToPasswordReset?.();
    };

    const handleSocialLogin = async (provider: 'google' | 'facebook') => {
        try {
            setSocialLoading(provider);
            setErrorMsg("");
            const supabase = getSupabaseBrowserClient();

            const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;

            const { error } = await supabase.auth.signInWithOAuth({
                provider,
                options: {
                    redirectTo: `${siteUrl}/auth/callback`,
                    queryParams: {
                        access_type: 'offline',
                        prompt: 'consent',
                    },
                },
            });

            if (error) {
                throw error;
            }
            // El navegador será redirigido automáticamente por Supabase
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            setErrorMsg(message || t('auth.login.errorFallback'));
            setSocialLoading(null);
        }
    };

    const currentStrengthInfo = getPasswordStrengthInfo(password);

    return (
        <div className="login-card">
            {/* Tabs */}
            <div className="auth-tabs-pl">
                <button
                    type="button"
                    className={`auth-tab-pl ${isLogin ? 'active' : ''}`}
                    onClick={() => setIsLogin(true)}
                >
                    {t('auth.common.login')}
                </button>
                <button
                    type="button"
                    className={`auth-tab-pl ${!isLogin ? 'active' : ''}`}
                    onClick={() => setIsLogin(false)}
                >
                    {t('auth.common.register')}
                </button>
            </div>

            {isLogin ? (
                // LOGIN FORM
                <form onSubmit={handleLogin}>
                    <h2>{t('auth.login.welcomeBack')}</h2>
                    <p className="subtitle">{t('auth.login.welcomeMessage')}</p>

                    <div style={{ marginBottom: '20px' }}>
                        <label className="pl-form-label" htmlFor="login-email">
                            {t('auth.common.email')}
                        </label>
                        <input
                            type="email"
                            id="login-email"
                            className={`pl-form-input ${emailError ? 'invalid' : ''}`}
                            placeholder={t('auth.common.emailPlaceholder')}
                            value={email}
                            maxLength={MAX_EMAIL}
                            onChange={(e) => setEmail(e.target.value.slice(0, MAX_EMAIL))}
                            required
                        />
                        {emailError && <p className="error-message-pl">{emailError}</p>}
                    </div>

                    <div style={{ marginBottom: '8px' }}>
                        <label className="pl-form-label" htmlFor="login-password">
                            {t('auth.common.password')}
                        </label>
                        <div className="password-container-pl">
                            <input
                                type={showPassword ? "text" : "password"}
                                id="login-password"
                                className={`pl-form-input ${passwordError ? 'invalid' : ''}`}
                                placeholder="••••••••"
                                value={password}
                                maxLength={MAX_PASSWORD}
                                onChange={(e) => setPassword(e.target.value.slice(0, MAX_PASSWORD))}
                                required
                            />
                            <span className="password-toggle-pl" onClick={() => setShowPassword(!showPassword)}>
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </span>
                        </div>
                        {passwordError && <p className="error-message-pl">{passwordError}</p>}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '24px' }}>
                        <a href="#" className="link-secondary-pl" onClick={handleForgotPassword}>
                            {t('auth.common.forgotPassword')}
                        </a>
                    </div>

                    {errorMsg && (
                        <p className="error-message-pl" style={{ marginBottom: '16px' }}>{errorMsg}</p>
                    )}

                    <button
                        type="submit"
                        className="btn-primary-pl"
                        disabled={loading || !email || !password}
                    >
                        {loading && <span className="spinner-pl"></span>}
                        {loading ? t('auth.common.loadingLogin') : t('auth.common.login')}
                    </button>

                    <div className="separator-pl">{t('auth.common.orContinueWith') || 'o continúa con'}</div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                        <button
                            type="button"
                            className="social-btn-pl"
                            onClick={() => handleSocialLogin('google')}
                            disabled={socialLoading !== null}
                        >
                            {socialLoading === 'google' ? (
                                <span className="spinner-pl" style={{ width: '20px', height: '20px' }}></span>
                            ) : (
                                <svg className="w-5 h-5" viewBox="0 0 24 24" style={{ width: '20px', height: '20px' }}>
                                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                                </svg>
                            )}
                            Google
                        </button>
                        <button
                            type="button"
                            className="social-btn-pl"
                            onClick={() => handleSocialLogin('facebook')}
                            disabled={socialLoading !== null}
                        >
                            {socialLoading === 'facebook' ? (
                                <span className="spinner-pl" style={{ width: '20px', height: '20px' }}></span>
                            ) : (
                                <svg style={{ width: '20px', height: '20px' }} fill="#1877F2" viewBox="0 0 24 24">
                                    <path d="M12 0c-6.627 0-12 5.373-12 12s5.373 12 12 12 12-5.373 12-12-5.373-12-12-12zm3 8h-1.35c-.538 0-.65.221-.65.778v1.222h2l-.209 2h-1.791v7h-3v-7h-2v-2h2v-2.308c0-1.769.931-2.692 3.029-2.692h1.971v3z" />
                                </svg>
                            )}
                            Facebook
                        </button>
                    </div>

                    <p style={{ textAlign: 'center', fontSize: '14px', color: 'var(--pl-gray-text)' }}>
                        {t('auth.common.noAccount') || '¿No tienes cuenta?'}{' '}
                        <a href="#" className="link-accent-pl" onClick={(e) => { e.preventDefault(); setIsLogin(false); }}>
                            {t('auth.common.createAccount') || 'Crear cuenta'}
                        </a>
                    </p>
                </form>
            ) : (
                // REGISTER FORM
                <form onSubmit={handleRegister}>
                    <h2>{t('auth.register.helloFriend')}</h2>
                    <p className="subtitle">{t('auth.register.helloMessage')}</p>

                    <div style={{ marginBottom: '16px' }}>
                        <label className="pl-form-label" htmlFor="register-fullname">
                            {t('auth.common.fullName')}
                        </label>
                        <input
                            type="text"
                            id="register-fullname"
                            className={`pl-form-input ${nameError ? 'invalid' : ''}`}
                            placeholder={t('auth.common.fullNamePlaceholder')}
                            value={fullName}
                            maxLength={MAX_NAME}
                            onChange={(e) => setFullName(e.target.value.slice(0, MAX_NAME))}
                            required
                        />
                        {nameError && <p className="error-message-pl">{nameError}</p>}
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                        <label className="pl-form-label" htmlFor="register-email">
                            {t('auth.common.email')}
                        </label>
                        <input
                            type="email"
                            id="register-email"
                            className={`pl-form-input ${emailError ? 'invalid' : ''}`}
                            placeholder={t('auth.common.emailPlaceholder')}
                            value={email}
                            maxLength={MAX_EMAIL}
                            onChange={(e) => setEmail(e.target.value.slice(0, MAX_EMAIL))}
                            required
                        />
                        {emailError && <p className="error-message-pl">{emailError}</p>}
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                        <label className="pl-form-label" htmlFor="register-password">
                            {t('auth.common.password')}
                        </label>
                        <div className="password-container-pl">
                            <input
                                type={showPassword ? "text" : "password"}
                                id="register-password"
                                className="pl-form-input"
                                placeholder={t('auth.common.passwordPlaceholder')}
                                value={password}
                                maxLength={MAX_PASSWORD}
                                onChange={(e) => handlePasswordChange(e.target.value.slice(0, MAX_PASSWORD))}
                                required
                            />
                            <span className="password-toggle-pl" onClick={() => setShowPassword(!showPassword)}>
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </span>
                        </div>
                        {password.length > 0 && (
                            <div style={{ marginTop: '8px' }}>
                                <div style={{
                                    fontSize: '12px',
                                    color: currentStrengthInfo.level === 'low' ? '#EF4444' :
                                        currentStrengthInfo.level === 'medium' ? '#F59E0B' :
                                            currentStrengthInfo.level === 'strong' ? '#10B981' : '#059669',
                                    marginBottom: '4px'
                                }}>
                                    {currentStrengthInfo.text}
                                </div>
                                <div style={{
                                    height: '4px',
                                    background: '#E5E7EB',
                                    borderRadius: '2px',
                                    overflow: 'hidden'
                                }}>
                                    <div style={{
                                        height: '100%',
                                        width: currentStrengthInfo.level === 'low' ? '25%' :
                                            currentStrengthInfo.level === 'medium' ? '50%' :
                                                currentStrengthInfo.level === 'strong' ? '75%' :
                                                    currentStrengthInfo.level === 'very-strong' ? '100%' : '0%',
                                        background: currentStrengthInfo.level === 'low' ? '#EF4444' :
                                            currentStrengthInfo.level === 'medium' ? '#F59E0B' :
                                                currentStrengthInfo.level === 'strong' ? '#10B981' : '#059669',
                                        transition: 'width 0.3s ease'
                                    }}></div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div style={{ marginBottom: '20px' }}>
                        <label className="pl-form-label" htmlFor="register-confirm-password">
                            {t('auth.common.confirmPassword')}
                        </label>
                        <div className="password-container-pl">
                            <input
                                type={showConfirmPassword ? "text" : "password"}
                                id="register-confirm-password"
                                className={`pl-form-input ${passwordMatchError ? 'invalid' : ''}`}
                                placeholder={t('auth.common.passwordPlaceholder')}
                                value={confirmPassword}
                                maxLength={MAX_PASSWORD}
                                onChange={(e) => {
                                    const val = e.target.value.slice(0, MAX_PASSWORD);
                                    setConfirmPassword(val);
                                    setPasswordMatchError(password !== val && val.length > 0);
                                }}
                                required
                            />
                            <span className="password-toggle-pl" onClick={() => setShowConfirmPassword(!showConfirmPassword)}>
                                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </span>
                        </div>
                        {passwordMatchError && (
                            <p className="error-message-pl">{t('auth.common.passwordsNoMatch')}</p>
                        )}
                    </div>

                    {errorMsg && (
                        <p className="error-message-pl" style={{ marginBottom: '16px' }}>{errorMsg}</p>
                    )}
                    {successMsg && (
                        <p className="success-message-pl" style={{ marginBottom: '16px' }}>{successMsg}</p>
                    )}

                    <button
                        type="submit"
                        className="btn-primary-pl"
                        disabled={loading || !fullName || !email || !password || !confirmPassword || password !== confirmPassword}
                    >
                        {loading && <span className="spinner-pl"></span>}
                        {loading ? t('auth.common.loadingRegister') : t('auth.common.register')}
                    </button>

                    <p style={{ textAlign: 'center', fontSize: '14px', color: 'var(--pl-gray-text)', marginTop: '24px' }}>
                        {t('auth.common.alreadyHaveAccount') || '¿Ya tienes cuenta?'}{' '}
                        <a href="#" className="link-accent-pl" onClick={(e) => { e.preventDefault(); setIsLogin(true); }}>
                            {t('auth.common.login')}
                        </a>
                    </p>
                </form>
            )}
        </div>
    );
}
