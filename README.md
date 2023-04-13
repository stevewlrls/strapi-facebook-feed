# Strapi plugin facebook-feed

I created this plugin to fetch posts from a Facebook page and make them available to a website without the latter having to manage the Facebook Graph API. (I had hoped to find one on the Strapi Marketplace but couldn't.)

## Installing

At the moment, the plugin isn't published as an NPM package, but you can clone the repository and copy the files into the 'plugins' folder within your Strapi installation. You then need to add the following to `{strapi}/config/plugins.js`:

```js
module.exports = {
  'facebook-feed': {
    enabled: true,
    resolve: './src/plugins/facebook-feed',
  },
}
```

Because the Facebook login API can only be invoked from a web page that's fetched with HTTPS, you'll need to configure your Strapi admin UI to be accessible through a reverse proxy (with SSL). You'll also need to alter the Content Security Policy settings of your Strapi setup, to allow access to the Facebook API:

In `{strapi}/config/middlewares.js`:

```js
{
  'strapi::errors',
  //'strapi::security',
  {
    name: 'strapi::security',
    config: {
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'script-src': ["'self'", "connect.facebook.net"]
        }
      }
    }
  },
  'strapi::cors',
  //...
}
```

If you're unsure how to get an SSL reverse proxy working in front of your Strapi build, check out the options in the [Strapi depoyment docs](https://docs.strapi.io/dev-docs/deployment/optional-software-guides), or check out [mitmproxy](https://mitmproxy.org).

Once the plugin is installed, you will also need to rebuild your admin UI, in the usual way, e.g.:

```
yarn build
```

## Usage

### Settings

The plugin provides a 'settings' page that you need to visit first. This provides fields for the entry of data about the Facebook 'app' that will be used to fetch posts.

For obvious security reasons, Facebook limits access to the data on or about a page. However, the owner of a page can create a 'developer' account [https://developer.facebook.com] and, within that, create their own, private 'app' that can then be used to access content without the need for a formal review of the app's purpose.

\[I decided not to have a single 'app' that all users of the plugin would share, because that _would_ have required a formal review, _and_ I would have had to create a whole business (to own the app) that Facebook (Meta) could verify.\]

### Connecting A Page

After you have set up the app details, you can head over to the 'home panel' for the plugin and connect to a page that you own. This will take you through a Facebook login and authorization process, after which the plugin will store connection details (long-lived page access token) in the Strapi database.

If the connection process doesn't seem to work, this could be because you have a different Facebook plugin installed, and they are competing to initialise the Facebook API. Try reloading the page.

### Fetching Posts

The plugin sets up a Strapi 'cron' job that runs every day, at around 11pm, to fetch new posts. If you want it to run more often, edit the file 'server/bootstrap.js' within the plugin folder. However, you can also use the plugin 'home panel' to request an immediate update.

## Content Model

You can see the content model for Facebook posts, once the plugin has been installed and initialised. You can also browse and even edit posts, after they have been fetched. You can use the content builder to modify the post fields, too: just remember to keep the same names! (If you add fields with different names, they'll be available for manual edit only.)

Posts are made available via the Strapi 'api' endpoint via the route `/api/facebook-feed/facebook-posts` just like other content types.

## Caveats

Once the plugin has been activated for the first time, content types can no longer be modified via the schema definitions within the plugin code. This is a feature of Strapi.

The admin pages for the plugin (settings and home panel) are only available to users with 'Administrator' role. This is again 'by design' and helps protect both sensitive data (app details) and correct operation of the plugin.
