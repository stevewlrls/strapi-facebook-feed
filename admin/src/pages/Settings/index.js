import React, { useState, useEffect } from 'react';
import { HeaderLayout, ContentLayout, Button, TextInput, Grid, GridItem } from '@strapi/design-system';
import { useNotification, getFetchClient } from '@strapi/helper-plugin';
import pluginId from '../../pluginId';

const Settings = () => {
  const [settings, updateSettings] = useState({
    appId: '',
    appName: '',
    appSecret: '',
    clientSecret: ''
  });
  const [isSaving, setSaving] = useState(false);
  const [isLoading, setLoading] = useState(true);
  const setNotice = useNotification();

  useEffect(loadSettings, []);

  return (
    <>
      <HeaderLayout
        id="title"
        title="Facebook App Settings"
        primaryAction={
          <Button
            onClick={saveSettings}
            disabled={isSaving || isLoading}
          >Save</Button>
        }
      ></HeaderLayout>
      <ContentLayout>
        <Grid gap={4} gridCols={2}>
          <GridItem>
            <TextInput
              label="App name"
              name="app-name"
              value={settings.appName}
              onChange={(e) => updateSettings({...settings, appName: e.target.value})}
            />
          </GridItem>
          <GridItem>
            <TextInput
              label="App ID"
              name="app-id"
              value={settings.appId}
              onChange={(e) => updateSettings({...settings, appId: e.target.value})}
            />
          </GridItem>
          <GridItem>
            <TextInput
              label="App secret"
              name="app-secret"
              value={settings.appSecret}
              onChange={(e) => updateSettings({...settings, appSecret: e.target.value})}
            />
          </GridItem>
          <GridItem>
            <TextInput
              label="Client secret"
              name="client-secret"
              value={settings.clientSecret}
              onChange={(e) => updateSettings({...settings, clientSecret: e.target.value})}
            />
          </GridItem>
        </Grid>
      </ContentLayout>
    </>
  )

  function loadSettings() {
    const { get } = getFetchClient();
    get(`/${pluginId}/settings`)
      .then(rsp => {
        updateSettings(rsp.data);
        setLoading(false);
      })
  }

  function saveSettings() {
    setSaving(true);
    const { post } = getFetchClient();
    post(`/${pluginId}/settings`, settings)
    .then(rsp => {
      setNotice({
        type: rsp.data.ok ? 'success' : 'error',
        message: rsp.data.ok ? 'Saved.' : rsp.data.error
      });
      setSaving(false);
    })
  }
}

export default Settings;