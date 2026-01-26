"use client";

import React from 'react';
import ConfigurationContent from '@/components/shared/configuration/ConfigurationContent';
import { useAdminContext } from '@/lib/AdminContext';
import { useAdminLayoutContext } from '@/lib/AdminLayoutContext';
import Header from '@/components/layout/Header';
import { useTranslation } from '@/hooks/useTranslation';

export default function ConfiguracionPage() {
  const { setAdmin } = useAdminContext();
  const { toggleMobileMenu } = useAdminLayoutContext();
  const { t } = useTranslation();

  return (
    <>
      <Header
        onMenuToggle={toggleMobileMenu}
        notifications={0} // Default for config page
        title={t('admin.configuration.title')}
        subtitle={t('admin.configuration.subtitle')}
      />
      <div className="w-full flex-1">
        <ConfigurationContent
          role="admin"
          onUserImageUpdate={(url) => setAdmin({ userImage: url })}
          layoutMode="integrated"
        />
      </div>
    </>
  );
}