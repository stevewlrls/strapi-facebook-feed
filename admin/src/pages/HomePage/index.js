/*
 *
 * HomePage
 *
 */

import React, { useEffect, useState } from 'react';
import { BaseHeaderLayout, ContentLayout, Typography, Button, Box } from '@strapi/design-system';
import { useNotification, getFetchClient } from '@strapi/helper-plugin';
// import PropTypes from 'prop-types';
import pluginId from '../../pluginId';

const HomePage = () => {
  const [params, setParams] = useState(null);
  const [isInitialised, setInitialised] = useState(false);
  const [isConnecting, setConnecting] = useState(false);
  const [isFetching, setFetching] = useState(false);
  const setNotice = useNotification();

  useEffect(getSettings, []);

  return (
    <>
      <BaseHeaderLayout
        title="Facebook Feed"
        subtitle="This plugin allows you to connect Strapi to a Facebook page, to fetch posts into a
        Strapi collection (facebook-posts)."
      />
      <ContentLayout>
        {
          params?.pageName ? (
            <Typography>
              You have already connected to "{params.pageName}", but you can use the button
              below to reset the connection, or choose a different page.
            </Typography>
          ) : (
            <Typography>
              You have not yet connected to a Facebook page. Use the button below to authorize
              the Facebook Feed plugin to fetch data from a (single) page of your choice.
            </Typography>
          )
        }
        <Box padding="5" >
          <form method="POST" action="/facebook-feed/connect" onSubmit={connectPage}>
            <Button
              type="submit"
              disabled={isConnecting || ! isInitialised}
            >Connect</Button>
          </form>
        </Box>
        {
          params?.pageName && (
            <>
              <Typography>
                New posts will be fetched in the background (once a day, at around 11pm),
                but if you want to, you can trigger that operation now:
              </Typography>
              <Box padding="5">
                <form method="POST" action="/facebook-feed/fetch" onSubmit={fetchPosts}>
                  <Button
                    type="submit"
                    disabled={isFetching}
                  >Fetch posts</Button>
                </form>
              </Box>
            </>
          )
        }
      </ContentLayout>
    </>
  );

  function getSettings() {
    const { get } = getFetchClient();
    get(`/${pluginId}/connect`)
      .then(rsp => {
        console.log('response', JSON.stringify(rsp));
        setParams(rsp.data);
        initFacebookAPI(rsp.data.appId);
      });
  }

  function initFacebookAPI(appId) {
    if (document.getElementById('facebook-feed-sdk')) {
      setInitialised(true); // Script already loaded...
      return;
    }
    window.fbAsyncInit = function () {
      window.FB.init({
        appId,
        xfbml: true,
        version: 'v16.0'
      });
      setInitialised(true);
    };
    const fbs = document.createElement('script');
    fbs.id = 'facebook-feed-sdk';
    fbs.src = 'https://connect.facebook.net/en_US/sdk.js';
    fbs.async = true;
    fbs.defer = true;
    fbs.crossOrigin = 'anonymous';
    document.body.appendChild(fbs);
  }

  function connectPage(ev) {
    ev.preventDefault();
    setConnecting(true);
    window.FB.login(
      (response) => {
        if (response.status === 'connected') {
          const { post } = getFetchClient();
          post(`/${pluginId}/connect`, {
            userToken: response.authResponse.accessToken,
            userID: response.authResponse.userID
          })
          .then(rsp => {
            setConnecting(false);
            if (rsp.data.pageName) {
              setParams(rsp.data);
              setNotice({
                type: 'success',
                message: 'Connected.'
              })
            }
            else {
              setNotice({
                type: 'error',
                message: rsp.data.error
              })
            }
          })
        }
      },
      {scope: 'pages_read_engagement,pages_read_user_content'}
    );
  }

  function fetchPosts(ev) {
    ev.preventDefault()
    setFetching(true);
    const { post } = getFetchClient();
    post(`/${pluginId}/fetch-posts`)
      .then(rsp => {
        setFetching(false);
        setNotice({
          type: 'success',
          message: `Fetch completed: ${rsp.data.fetched} new post(s).`
        });
      })
      .catch(err => {
        setFetching(false);
        setNotice({
          type: 'error',
          message: 'Fetch failed: ' + err.message
        })
      });
  }
};

export default HomePage;
