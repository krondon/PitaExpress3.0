import "../styles/auth/AuthPage.css";
import "../styles/auth/PasswordReset.css";
import "../styles/auth/LoginInfo.css";
import "../styles/auth/PremiumLanding.css";
import React from "react";
import VideoBackground from "@/components/login-info/VideoBackground";

export default function LoginRegisterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <VideoBackground />
      {children}
    </>
  );
}
