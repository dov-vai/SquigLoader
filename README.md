<h1 align="center">SquigLoader</h1>

Load any [squig.link](https://squig.link/) measurement from other reviewers on the same graph.

# Installation
This is a userscript. A browser extension that can load them is neccessary.

I recommend Tampermonkey:
- [Firefox](https://addons.mozilla.org/en-US/firefox/addon/tampermonkey/)
- [Chromium](https://chromewebstore.google.com/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)
- [Kiwi Browser](https://chromewebstore.google.com/detail/tampermonkey-legacy/lcmhijbkigalmkeommnijlpobloojgfn) (Tampermonkey Legacy, version, as there's [a bug](https://github.com/Tampermonkey/tampermonkey/issues/2055#issuecomment-2225438775) in Kiwi Browser)

Then click [here](https://github.com/dov-vai/SquigLoader/raw/refs/heads/main/SquigLoader.user.js) to install.

Or browse to the user.js file in the repository and hit the "Raw" button.

# Usage
An extra button should appear in the search list:

![image](https://github.com/user-attachments/assets/6a9744d4-3e1c-48e7-9615-df038e6b7735)

# Warning
The measurements are separated between reviewers because all of them have varying couplers, so the measurements won't align very well.

I choose to be stupid, and think it's still a good utility for referencing several frequency responses. Just take it with a grain of salt.

# Issues
Some sites will outright not load:
- Some subdomains do not allow [CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)
- Some have encrypted files ([hangout.audio](https://graph.hangout.audio/)).

As a workaround, you can visit them directly and use SquigLoader from there. 

The script should continue working with less restrictions.

## Headphones
Headphone squig.link sites have a hardcoded feature in them that let's you view multiple measurements of the same headphone.

IEM-only sites restrict that. So only one will be viewable.

The loader tries to load multiple measurements, but they will only be viewable from the headphone sites.

# Not working?
Perhaps the site has updated and I just haven't visited squig.link recently. Feel free to open an issue so I get a reminder.
