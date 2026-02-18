"use client";

import React, { useEffect, useRef, useState } from "react";
import { MAX_NAME, MAX_EMAIL, MAX_PASSWORD } from '@/lib/constants/validation';
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import Lottie from "react-lottie";
import { Eye, EyeOff } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { useLanguage } from "@/lib/LanguageContext";

export default function RegisterForm() {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const [registerAnim, setRegisterAnim] = useState<any | null>(null);
  const [successAnim, setSuccessAnim] = useState<any | null>(null);
  const [registerAnimError, setRegisterAnimError] = useState<boolean>(false);

  React.useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/animations/Register.json").then((r) => {
        if (!r.ok) throw new Error(t('auth.common.registerAnimationLoadError'));
        return r.json();
      }),
      fetch("/animations/Success.json").then((r) => {
        if (!r.ok) throw new Error(t('auth.common.animationLoadError'));
        return r.json();
      })
    ])
      .then(([reg, suc]) => {
        if (!cancelled) {
          setRegisterAnim(reg);
          setSuccessAnim(suc);
        }
      })
      .catch(() => {
        if (!cancelled) setRegisterAnimError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  const [fullName, setFullName] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);
  const [passwordMatchError, setPasswordMatchError] = useState<boolean>(false);
  const [passwordStrength, setPasswordStrength] = useState<
    "none" | "low" | "medium" | "strong" | "very-strong"
  >("none");
  const [isPasswordFocused, setIsPasswordFocused] = useState<boolean>(false);
  const [showFeedbackDiv, setShowFeedbackDiv] = useState<boolean>(false);
  const [animateFeedback, setAnimateFeedback] = useState<boolean>(false);
  const [showMatchErrorDiv, setShowMatchErrorDiv] = useState<boolean>(false);
  const [animateMatchError, setAnimateMatchError] = useState<boolean>(false);
  const [showCheckmark, setShowCheckmark] = useState<boolean>(false);

  const strengthTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const matchErrorTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const checkmarkTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const defaultRegisterOptions = registerAnim
    ? {
      loop: true,
      autoplay: true,
      animationData: registerAnim,
      rendererSettings: { preserveAspectRatio: "xMidYMid slice" },
    }
    : null;

  const defaultCheckmarkOptions = successAnim
    ? {
      loop: false,
      autoplay: true,
      animationData: successAnim,
      rendererSettings: { preserveAspectRatio: "xMidYMid slice" },
    }
    : null;

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

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const newPassword = e.target.value;
    setPassword(newPassword);
    const { level } = getPasswordStrengthInfo(newPassword);
    setPasswordStrength(level);

    if (confirmPassword.length > 0) {
      setPasswordMatchError(newPassword !== confirmPassword);
    } else {
      setPasswordMatchError(false);
    }
  };

  const handlePasswordFocus = (): void => setIsPasswordFocused(true);
  const handlePasswordBlur = (): void => setIsPasswordFocused(false);

  const handleConfirmPasswordChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ): void => {
    const newConfirmPassword = e.target.value;
    setConfirmPassword(newConfirmPassword);
    const doMatch = password === newConfirmPassword && newConfirmPassword.length > 0;
    setPasswordMatchError(!doMatch);
  };

  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [successMsg, setSuccessMsg] = useState<string>("");
  const [nameError, setNameError] = useState<string>("");
  const [emailError, setEmailError] = useState<string>("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    let valid = true;
    setNameError("");
    setEmailError("");

    // Validación de nombre
    if (!fullName.trim()) {
      setNameError(t('auth.common.nameRequired'));
      valid = false;
    } else if (fullName.trim().length < 3 || !/^[A-Za-zÁÉÍÓÚáéíóúÑñ ]+$/.test(fullName.trim())) {
      setNameError(t('auth.common.nameInvalid'));
      valid = false;
    }
    // Validación de email
    if (!email.trim()) {
      setEmailError(t('auth.common.emailRequired'));
      valid = false;
    } else if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setEmailError(t('auth.common.invalidEmailAlt'));
      valid = false;
    }
    // Validación de contraseñas
    if (!password) {
      // reutilizamos feedback de fortaleza
      valid = false;
    }
    if (password !== confirmPassword) {
      setPasswordMatchError(true);
      valid = false;
    }
    if (passwordStrength === "low" || passwordStrength === "none") {
      // No alert inmediato; mostramos mensaje general
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
      // Insertar datos en tabla clients
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
        // Insertar nivel por defecto en tabla userlevel (lado servidor)
        try {
          const res = await fetch("/api/auth/after-signup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userId,
              userLevel: "Client",
              preferredLanguage: ["es", "en", "zh"].includes(language) ? language : "es",
            }),
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

  const toggleShowPassword = (): void => setShowPassword(!showPassword);
  const toggleShowConfirmPassword = (): void => setShowConfirmPassword(!showConfirmPassword);

  const currentStrengthInfo = getPasswordStrengthInfo(password);

  useEffect(() => {
    return () => {
      if (strengthTimeoutRef.current) clearTimeout(strengthTimeoutRef.current);
      if (matchErrorTimeoutRef.current) clearTimeout(matchErrorTimeoutRef.current);
      if (checkmarkTimeoutRef.current) clearTimeout(checkmarkTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    const shouldShowStrengthFeedback = password.length > 0 && isPasswordFocused;
    if (shouldShowStrengthFeedback) {
      setShowFeedbackDiv(true);
      if (strengthTimeoutRef.current) clearTimeout(strengthTimeoutRef.current);
      strengthTimeoutRef.current = setTimeout(() => setAnimateFeedback(true), 50);
    } else {
      setAnimateFeedback(false);
      if (strengthTimeoutRef.current) clearTimeout(strengthTimeoutRef.current);
      strengthTimeoutRef.current = setTimeout(() => setShowFeedbackDiv(false), 300);
    }
  }, [password.length, isPasswordFocused]);

  useEffect(() => {
    if (passwordMatchError) {
      setShowMatchErrorDiv(true);
      if (matchErrorTimeoutRef.current) clearTimeout(matchErrorTimeoutRef.current);
      matchErrorTimeoutRef.current = setTimeout(() => setAnimateMatchError(true), 50);
    } else {
      setAnimateMatchError(false);
      if (matchErrorTimeoutRef.current) clearTimeout(matchErrorTimeoutRef.current);
      matchErrorTimeoutRef.current = setTimeout(() => setShowMatchErrorDiv(false), 300);
    }
  }, [passwordMatchError]);

  useEffect(() => {
    const shouldShowCheckmark = !passwordMatchError && confirmPassword.length > 0;
    if (shouldShowCheckmark) {
      setShowCheckmark(true);
      if (checkmarkTimeoutRef.current) clearTimeout(checkmarkTimeoutRef.current);
      checkmarkTimeoutRef.current = setTimeout(() => { }, 50);
    } else {
      if (checkmarkTimeoutRef.current) clearTimeout(checkmarkTimeoutRef.current);
      checkmarkTimeoutRef.current = setTimeout(() => setShowCheckmark(false), 0);
    }
  }, [passwordMatchError, confirmPassword.length]);

  return (
    <form className="auth-form register-form w-full max-w-lg py-2 px-2" onSubmit={handleSubmit}>
      <div className="register-lottie-icon">
        {defaultRegisterOptions && !registerAnimError && (
          <Lottie options={defaultRegisterOptions} height={50} width={50} />
        )}
        {registerAnimError && (
          <div style={{ color: 'red', fontSize: 12, textAlign: 'center' }}>
            <span style={{ fontSize: 20 }}>⚠️</span>
            <div>No se pudo cargar la animación de registro</div>
          </div>
        )}
      </div>
      <h2 className="text-lg">{t('auth.register.title')}</h2>

      <label htmlFor="register-fullname" className="text-sm">{t('auth.common.fullName')}</label>
      <input
        type="text"
        id="register-fullname"
        placeholder={t('auth.common.fullNamePlaceholder')}
        value={fullName}
        maxLength={MAX_NAME}
        onChange={(e) => setFullName(e.target.value.slice(0, MAX_NAME))}
        required
        className={`py-1 px-2 ${nameError ? 'invalid' : ''}`}
        aria-invalid={!!nameError}
        suppressHydrationWarning={true}
      />
      {fullName.length > 0 && fullName.length === MAX_NAME && (
        <p className="text-xs text-slate-500">{fullName.length}/{MAX_NAME}</p>
      )}
      {nameError && (
        <p className="text-red-500 text-xs mt-1" role="alert">{nameError}</p>
      )}

      <label htmlFor="register-email" className="text-sm">{t('auth.common.email')}</label>
      <input
        type="email"
        id="register-email"
        placeholder={t('auth.common.emailPlaceholder')}
        value={email}
        maxLength={MAX_EMAIL}
        onChange={(e) => setEmail(e.target.value.slice(0, MAX_EMAIL))}
        required
        className={`py-1 px-2 ${emailError ? 'invalid' : ''}`}
        aria-invalid={!!emailError}
        suppressHydrationWarning={true}
      />
      {email.length > 0 && email.length === MAX_EMAIL && (
        <p className="text-xs text-slate-500">{email.length}/{MAX_EMAIL}</p>
      )}
      {emailError && (
        <p className="text-red-500 text-xs mt-1" role="alert">{emailError}</p>
      )}

      <label htmlFor="register-password" className="text-sm">{t('auth.common.password')}</label>
      <div className="password-input-container">
        <input
          type={showPassword ? "text" : "password"}
          id="register-password"
          placeholder={t('auth.common.passwordPlaceholder')}
          value={password}
          maxLength={MAX_PASSWORD}
          onChange={handlePasswordChange}
          onFocus={handlePasswordFocus}
          onBlur={handlePasswordBlur}
          required
          className={`password-input py-1 px-2 ${currentStrengthInfo.level !== "none"
              ? `password-strength-border-${currentStrengthInfo.level}`
              : ""
            }`}
          suppressHydrationWarning={true}
        />
        {password.length > 0 && password.length === MAX_PASSWORD && (
          <span className="absolute -bottom-5 right-1 text-[10px] text-slate-500">{password.length}/{MAX_PASSWORD}</span>
        )}
        <span className="password-toggle-icon" onClick={toggleShowPassword}>
          {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
        </span>
        {showFeedbackDiv && (
          <div className={`password-strength-feedback ${animateFeedback ? "active" : ""}`}>
            <div
              className={`password-strength-text password-strength-text-${currentStrengthInfo.level} text-xs`}
            >
              {currentStrengthInfo.text}
            </div>
            <div className="password-strength-bar-container">
              <div
                className={`password-strength-bar password-strength-bar-${currentStrengthInfo.level}`}
              ></div>
            </div>
          </div>
        )}
      </div>

      <label htmlFor="register-confirm-password" className="text-sm">{t('auth.common.confirmPassword')}</label>
      <div className="password-input-container">
        <input
          type={showConfirmPassword ? "text" : "password"}
          id="register-confirm-password"
          placeholder={t('auth.common.passwordPlaceholder')}
          value={confirmPassword}
          maxLength={MAX_PASSWORD}
          onChange={handleConfirmPasswordChange}
          required
          className={`py-1 px-2 ${passwordMatchError ? 'invalid' : ''}`}
          aria-invalid={passwordMatchError}
          suppressHydrationWarning={true}
        />
        <span
          className={`password-toggle-icon ${showCheckmark ? "hidden" : ""}`}
          onClick={toggleShowConfirmPassword}
        >
          {showConfirmPassword ? <EyeOff size={14} /> : <Eye size={14} />}
        </span>
        {showMatchErrorDiv && (
          <p className={`password-error-message text-xs ${animateMatchError ? "active" : ""}`}>
            {t('auth.common.passwordsNoMatch')}
          </p>
        )}
        {showCheckmark && defaultCheckmarkOptions && (
          <div className="checkmark-icon-container">
            <Lottie options={defaultCheckmarkOptions} height={20} width={20} />
          </div>
        )}
      </div>

      {errorMsg && (
        <p className="text-red-500 text-xs mt-2" role="alert">{errorMsg}</p>
      )}
      {successMsg && (
        <p className="text-green-600 text-xs mt-2" role="status">{successMsg}</p>
      )}
      <button
        type="submit"
        disabled={loading || !fullName || !email || !password || !confirmPassword || password !== confirmPassword || fullName.length > MAX_NAME || email.length > MAX_EMAIL || password.length > MAX_PASSWORD || confirmPassword.length > MAX_PASSWORD}
        className="py-1 px-3 text-sm"
      >
        {loading ? t('auth.common.loadingRegister') : t('auth.common.register')}
      </button>
    </form>
  );
}

