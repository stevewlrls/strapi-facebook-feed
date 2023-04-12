/*
 *
 * HomePage
 *
 */

import React, { useEffect, useState } from 'react';
import {
  BaseHeaderLayout, ContentLayout, Typography, Button, Box, Flex, Checkbox
} from '@strapi/design-system';
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
        <form method="POST" action="/facebook-feed/connect" onSubmit={connectPage}>
          <Flex padding="5" gap="2">
            <Checkbox
              name="pageOnly"
              checked={params?.pageOnly}
              onChange={(e) => {
                setParams({...params, pageOnly: e.target.checked})
              }}
              hint="Check to disable Instagram"
            >Page only</Checkbox>
            <Button
              type="submit"
              disabled={isConnecting || ! isInitialised}
            >Connect</Button>
          </Flex>
        </form>
        {
          params?.pageName && (
            <>
              <Typography>
                New posts will be fetched in the background (once a day, at around 11pm),
                but if you want to, you can trigger that operation now:
              </Typography>
              <Box padding="5">
                <Button
                  disabled={isFetching}
                  onClick={fetchPosts}
                >Fetch posts</Button>
              </Box>
            </>
          )
        }
      </ContentLayout>
    </>
  );

  // getSettings
  //    Called on component mount, to fetch the Facebook app settings and
  // then attach the Facebook API.

  function getSettings() {
    const { get } = getFetchClient();
    get(`/${pluginId}/connect`)
      .then(rsp => {
        setParams(rsp.data);
        initFacebookAPI(rsp.data.appId);
      });
  }

  // initFacebookAPI
  //    Called when the Facebook app Id has been fetched, to load and
  // initialise the Javascript API, so we can later perform a Facebook
  // login with the right context.

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

  // connectPage
  //    Handles the 'submit' event for the page connection form. First
  // gets permission for the app, by invoking Facebook login with the
  // right parameters, then passes the returned user token to the back
  // end (server) code for the plugin, to complete the connection
  // process.

  function connectPage(ev) {
    ev.preventDefault();
    setConnecting(true);
    let scope = [
      'pages_read_engagement',
      'pages_read_user_content',
      'pages_show_list'
    ].join(',');
    if (! params.pageOnly)
      scope = scope + ',instagram_basic';

    window.FB.login(
      (response) => {
        if (response.status === 'connected') {
          const { post } = getFetchClient();
          post(`/${pluginId}/connect`, {
            userToken: response.authResponse.accessToken,
            userID: response.authResponse.userID,
            pageOnly: Boolean(params.pageOnly)
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
      { scope }
    );
  }

  // fetchPosts
  //    Event handler for the 'Fetch posts' button. Requests the back end
  // (server) part of the plugin to fetch new posts now.

  function fetchPosts(ev) {
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
