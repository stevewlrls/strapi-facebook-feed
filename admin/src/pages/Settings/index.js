import React from 'react';
import { HeaderLayout, ContentLayout, Typography } from '@strapi/design-system';

const Settings = () => {
  return (
    <>
      <HeaderLayout
        id="title"
        title="Facebook App Settings"
      ></HeaderLayout>
      <ContentLayout>
        <Typography>
          The settings for this plugin are configured in 'config/plugins.js'. Please refer to the installation guide for details.
        </Typography>
      </ContentLayout>
    </>
  )
}

export default Settings;