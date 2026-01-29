"use client";

import React, { useState, useEffect } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { Eye, EyeOff, ArrowLeft, Mail } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { MAX_EMAIL, MAX_PASSWORD } from "@/lib/constants/validation";

type Props = {
    onNavigateToAuth: () => void;
    initialStep?: number;
};

type Step = "email" | "success" | "new-password";

const COOLDOWN_SECONDS = 60;

export default function PremiumPasswordReset({ onNavigateToAuth, initialStep }: Props) {
    const { t } = useTranslation();
    const [step, setStep] = useState<Step>(initialStep === 2 ? "new-password" : "email");
    const [email, setEmail] = useState("");
    const [emailError, setEmailError] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [passwordMatchError, setPasswordMatchError] = useState(false);
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");
    const [passwordStrength, setPasswordStrength] = useState<"none" | "low" | "medium" | "strong" | "very-strong">("none");
    const [cooldown, setCooldown] = useState(0);

    // Contador de cooldown
    useEffect(() => {
        if (cooldown > 0) {
            const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [cooldown]);

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
        setNewPassword(value);
        const { level } = getPasswordStrengthInfo(value);
        setPasswordStrength(level);

        if (confirmPassword.length > 0) {
            setPasswordMatchError(value !== confirmPassword);
        }
    };

    // Enviar email de recuperación
    const handleSendEmail = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
        e.preventDefault();
        setErrorMsg("");

        if (!email) {
            setEmailError(t('auth.common.emailRequired'));
            return;
        }
        if (!validateEmail(email)) {
            setEmailError(t('auth.common.invalidEmail'));
            return;
        }
        setEmailError("");

        setLoading(true);
        try {
            const supabase = getSupabaseBrowserClient();
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: process.env.NEXT_PUBLIC_SITE_URL
                    ? `${process.env.NEXT_PUBLIC_SITE_URL}/login-register/reset`
                    : undefined,
            });
            if (error) throw error;
            setStep("success");
            setCooldown(COOLDOWN_SECONDS);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            setErrorMsg(message || t('auth.passwordReset.sendError'));
        } finally {
            setLoading(false);
        }
    };

    // Restablecer contraseña
    const handleResetPassword = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
        e.preventDefault();
        setErrorMsg("");

        if (newPassword !== confirmPassword) {
            setPasswordMatchError(true);
            return;
        }

        if (passwordStrength === "low" || passwordStrength === "none") {
            setErrorMsg(t('auth.common.passwordMustBeVeryStrong'));
            return;
        }

        setLoading(true);
        try {
            const supabase = getSupabaseBrowserClient();
            const { error } = await supabase.auth.updateUser({ password: newPassword });
            if (error) throw error;

            alert(t('auth.passwordReset.resetSuccess'));
            sessionStorage.setItem('fromPasswordReset', 'true');
            onNavigateToAuth?.();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            setErrorMsg(message || t('auth.passwordReset.resetError'));
        } finally {
            setLoading(false);
        }
    };

    // Reenviar email
    const handleResend = async () => {
        if (!email || cooldown > 0) return;
        setLoading(true);
        try {
            const supabase = getSupabaseBrowserClient();
            await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: process.env.NEXT_PUBLIC_SITE_URL
                    ? `${process.env.NEXT_PUBLIC_SITE_URL}/login-register/reset`
                    : undefined,
            });
            setCooldown(COOLDOWN_SECONDS);
        } catch {
            // silencioso
        } finally {
            setLoading(false);
        }
    };

    const currentStrengthInfo = getPasswordStrengthInfo(newPassword);

    return (
        <div className="login-card">
            {/* Botón volver */}
            <button
                type="button"
                className="back-button-pl"
                onClick={onNavigateToAuth}
                style={{
                    position: 'absolute',
                    top: '20px',
                    left: '20px',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    color: 'var(--pl-gray-text)',
                    fontSize: '14px'
                }}
            >
                <ArrowLeft size={18} />
                {t('auth.passwordReset.buttons.back')}
            </button>

            {step === "email" && (
                <form onSubmit={handleSendEmail} style={{ paddingTop: '40px' }}>
                    <h2>{t('auth.passwordReset.titles.reset')}</h2>
                    <p className="subtitle">{t('auth.passwordReset.descriptions.enterEmail')}</p>

                    <div style={{ marginBottom: '24px' }}>
                        <label className="pl-form-label" htmlFor="reset-email">
                            {t('auth.common.email')}
                        </label>
                        <input
                            type="email"
                            id="reset-email"
                            className={`pl-form-input ${emailError ? 'invalid' : ''}`}
                            placeholder={t('auth.common.emailPlaceholder')}
                            value={email}
                            maxLength={MAX_EMAIL}
                            onChange={(e) => setEmail(e.target.value.slice(0, MAX_EMAIL))}
                            required
                        />
                        {emailError && <p className="error-message-pl">{emailError}</p>}
                    </div>

                    {errorMsg && (
                        <p className="error-message-pl" style={{ marginBottom: '16px' }}>{errorMsg}</p>
                    )}

                    <button
                        type="submit"
                        className="btn-primary-pl"
                        disabled={loading || !email}
                    >
                        {loading && <span className="spinner-pl"></span>}
                        {loading ? t('auth.passwordReset.sending') : t('auth.passwordReset.buttons.continue')}
                    </button>
                </form>
            )}

            {step === "success" && (
                <div style={{ paddingTop: '40px', textAlign: 'center' }}>
                    <div style={{
                        width: '64px',
                        height: '64px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #10B981, #059669)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 24px'
                    }}>
                        <Mail size={28} color="white" />
                    </div>
                    <h2>{t('auth.passwordReset.linkSent.title')}</h2>
                    <p className="subtitle" style={{ marginBottom: '16px' }}>
                        {t('auth.passwordReset.linkSent.subtitle')}
                    </p>
                    <p style={{
                        fontWeight: '600',
                        color: 'var(--pl-primary)',
                        fontSize: '16px',
                        marginBottom: '24px'
                    }}>
                        {email}
                    </p>
                    <p style={{
                        fontSize: '14px',
                        color: 'var(--pl-gray-text)',
                        marginBottom: '32px'
                    }}>
                        {t('auth.passwordReset.linkSent.checkInbox')}
                    </p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <button
                            type="button"
                            className="btn-primary-pl"
                            onClick={onNavigateToAuth}
                        >
                            {t('auth.passwordReset.linkSent.backToLogin')}
                        </button>
                        <button
                            type="button"
                            className="social-btn-pl"
                            onClick={handleResend}
                            disabled={loading || cooldown > 0}
                            style={{ justifyContent: 'center' }}
                        >
                            {loading
                                ? t('auth.passwordReset.linkSent.resending')
                                : cooldown > 0
                                    ? `${t('auth.passwordReset.linkSent.resend')} (${cooldown}s)`
                                    : t('auth.passwordReset.linkSent.resend')
                            }
                        </button>
                    </div>
                </div>
            )}

            {step === "new-password" && (
                <form onSubmit={handleResetPassword} style={{ paddingTop: '40px' }}>
                    <h2>{t('auth.passwordReset.titles.new')}</h2>
                    <p className="subtitle">{t('auth.passwordReset.descriptions.createNew')}</p>

                    <div style={{ marginBottom: '16px' }}>
                        <label className="pl-form-label" htmlFor="new-password">
                            {t('auth.passwordReset.newPassword')}
                        </label>
                        <div className="password-container-pl">
                            <input
                                type={showPassword ? "text" : "password"}
                                id="new-password"
                                className="pl-form-input"
                                placeholder={t('auth.common.passwordPlaceholder')}
                                value={newPassword}
                                maxLength={MAX_PASSWORD}
                                onChange={(e) => handlePasswordChange(e.target.value.slice(0, MAX_PASSWORD))}
                                required
                            />
                            <span className="password-toggle-pl" onClick={() => setShowPassword(!showPassword)}>
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </span>
                        </div>
                        {newPassword.length > 0 && (
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

                    <div style={{ marginBottom: '24px' }}>
                        <label className="pl-form-label" htmlFor="confirm-new-password">
                            {t('auth.passwordReset.confirmNewPassword')}
                        </label>
                        <div className="password-container-pl">
                            <input
                                type={showConfirmPassword ? "text" : "password"}
                                id="confirm-new-password"
                                className={`pl-form-input ${passwordMatchError ? 'invalid' : ''}`}
                                placeholder={t('auth.common.passwordPlaceholder')}
                                value={confirmPassword}
                                maxLength={MAX_PASSWORD}
                                onChange={(e) => {
                                    const val = e.target.value.slice(0, MAX_PASSWORD);
                                    setConfirmPassword(val);
                                    setPasswordMatchError(newPassword !== val && val.length > 0);
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

                    <button
                        type="submit"
                        className="btn-primary-pl"
                        disabled={loading || !newPassword || !confirmPassword || newPassword !== confirmPassword}
                    >
                        {loading && <span className="spinner-pl"></span>}
                        {loading ? t('auth.passwordReset.resetting') : t('auth.passwordReset.buttons.reset')}
                    </button>
                </form>
            )}
        </div>
    );
}
