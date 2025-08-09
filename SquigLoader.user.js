// ==UserScript==
// @name         SquigLoader
// @namespace    SquigLoader
// @version      1.0.4
// @description  Load any squig.link measurement from other reviewers on the same graph.
// @author       dov-vai
// @match        https://*.squig.link/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=squig.link
// @grant        GM_xmlhttpRequest
// @connect      squig.link
// @connect      graph.hangout.audio
// @updateURL    https://github.com/dov-vai/SquigLoader/raw/refs/heads/main/SquigLoader.user.js
// @downloadURL  https://github.com/dov-vai/SquigLoader/raw/refs/heads/main/SquigLoader.user.js
// @require      https://cdn.jsdelivr.net/gh/brainfoolong/cryptojs-aes-php@master/dist/cryptojs-aes-format.js
// @require      https://cdn.jsdelivr.net/gh/brainfoolong/cryptojs-aes-php@master/dist/cryptojs-aes.min.js
// ==/UserScript==

(function () {
  'use strict';

  const ADD_BUTTON_CLASS = 'add-phone-button';
  const BUTTON_COLOR = 'var(--background-color-contrast-more)';
  const ALT_BUTTON_COLOR = 'var(--background-color-contrast)';
  const EXPANDED_CONTAINER_COLOR = 'rgba(0, 0, 0, 0.1)';
  const ADD_SYMBOL = '+';
  const REMOVE_SYMBOL = '-';
  const EXPAND_SYMBOL = '▲';
  const HIDE_SYMBOL = '▼';
  const WARNING_SYMBOL = '!';

  function createListButton() {
    const button = document.createElement('button');

    let buttonColor = BUTTON_COLOR;
    // fix for crinacle's site, because the button is invisible
    if (window.location.href.startsWith('https://graph.hangout.audio/')) {
      buttonColor = ALT_BUTTON_COLOR;
    }

    button.style.cssText = `
    margin-right: 10px;
    font-size: 24px;
    border-radius: 50%;
    color: ${buttonColor};
    background-color: transparent;
    border: 1px solid ${buttonColor};
    cursor: pointer;
    width: 32px;
    height: 32px;
    display: flex;
    justify-content: center;
    align-items: center;
`;
    return button;
  }

  function createAddButton() {
    const addButton = createListButton();
    addButton.textContent = ADD_SYMBOL;
    addButton.classList.add(ADD_BUTTON_CLASS);
    return addButton;
  }

  function createExpandButton() {
    const expandButton = createListButton();
    expandButton.textContent = EXPAND_SYMBOL;
    expandButton.classList.add('expand-phones-button');
    expandButton.style.fontSize = '12px';
    return expandButton;
  }

  function addFauxnItemsToParent(fauxnItem, siteUrl, files) {
    const clonedItem = fauxnItem.cloneNode(true);
    const parent = fauxnItem.parentNode;

    const linksContainer = document.createElement('div');
    linksContainer.style.display = 'none';
    linksContainer.style.backgroundColor = EXPANDED_CONTAINER_COLOR;

    const expandButton = createExpandButton();
    fauxnItem.appendChild(expandButton);

    let expanded = false;
    expandButton.addEventListener('click', async (event) => {
      linksContainer.style.display = expanded ? 'none' : 'block';
      expandButton.textContent = expanded ? EXPAND_SYMBOL : HIDE_SYMBOL;
      expanded = !expanded;
    });

    files.forEach((file) => {
      const newFauxnItem = clonedItem.cloneNode(true);

      const brand = fauxnItem.getAttribute('name').split(': ')[0];
      newFauxnItem.setAttribute('name', `${brand}: ${file}`);

      // remove the old cloned button
      const button = newFauxnItem.querySelector(`button.${ADD_BUTTON_CLASS}`);
      newFauxnItem.removeChild(button);

      const newFauxnLink = newFauxnItem.querySelector('a.fauxn-link');
      newFauxnLink.href = `${siteUrl}?share=${file.replace(/ /g, '_')}`;
      newFauxnLink.textContent = file;

      addShowPhoneButton(newFauxnItem, true);
      linksContainer.appendChild(newFauxnItem);
    });

    parent.insertBefore(linksContainer, fauxnItem.nextSibling);
  }

  function addShowPhoneButton(fauxnItem, phoneBookLoaded) {
    const addButton = createAddButton();
    fauxnItem.appendChild(addButton);

    const [brandName, phoneName] = fauxnItem
      .getAttribute('name')
      .split(': ')
      .map((s) => s.trim());
    const fauxnLink = fauxnItem.querySelector('a.fauxn-link');
    const siteUrl = fauxnLink.href.split('/?share=')[0] + '/';
    const fileName = fauxnLink.href.split('/?share=')[1].replace(/_/g, ' ');

    addButton.addEventListener('click', async (event) => {
      event.preventDefault();
      event.stopPropagation();

      if (!phoneBookLoaded) {
        findFilesInPhoneBook(siteUrl, fileName).then((files) => {
          files = files.filter((file) => file != fileName);
          if (files.length > 0) {
            addFauxnItemsToParent(fauxnItem, siteUrl, files);
          }
          phoneBookLoaded = true;
        });
      }

      let phoneObj = {
        brand: null,
        dispBrand: brandName,
        phone: phoneName,
        dispName: phoneName,
        fullName: brandName + ' ' + phoneName,
        rawChannels: null,
      };

      let brandObj = {
        active: false,
        name: brandName,
        phoneObjs: [phoneObj],
        phones: [],
      };

      phoneObj.brand = brandObj;

      try {
        const phoneIndex = allPhones.findIndex(
          (p) =>
            p.dispBrand === phoneObj.dispBrand &&
            p.dispName === phoneObj.dispName
        );

        if (phoneIndex === -1) {
          await loadExternalFile(phoneObj, siteUrl, fileName);
          allPhones.push(phoneObj);
          handleShowPhone(phoneObj, false);
          addButton.textContent = '–';
          return;
        }
        // if it exists, reference the already created phoneObj
        phoneObj = allPhones[phoneIndex];
        phoneObj.active
          ? removePhone(phoneObj)
          : handleShowPhone(phoneObj, false);
        addButton.textContent = phoneObj.active ? REMOVE_SYMBOL : ADD_SYMBOL;
      } catch (error) {
        console.error('Error loading data for', phoneName, error);
        addButton.textContent = WARNING_SYMBOL;
      }
    });
  }

  function handleShowPhone(p, exclusive, suppressVariant, trigger) {
    try {
      showPhone(p, exclusive, suppressVariant, trigger);
    } catch (error) {
      // ignore this error, showPhone handles list view updating too, however it's not needed for us and causes this error
      if (
        error instanceof TypeError &&
        error.message.includes('phoneListItem is null')
      ) {
        console.warn('Ignoring TypeError: phoneListItem is null');
      } else {
        throw error;
      }
    }
  }

  function interpolateData(channelFiles) {
    return channelFiles
      .map((data) => {
        if (data) {
          const parsedData = tsvParse(data);
          return Equalizer.interp(f_values, parsedData);
        } else {
          return null;
        }
      })
      .filter((channel) => channel !== null);
  }

  function extractPathFromUrl(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.pathname.substring(1);
    } catch (error) {
      console.error('Error parsing URL:', error);
      return null;
    }
  }

  function fetchHangoutAudio(filePath, channelFiles, fileName) {
    const encodedPath = encodeURIComponent(filePath);
    const pass = 'hi_crinacle!';

    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'POST',
        url: 'https://graph.hangout.audio/d-c.php',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Referer': 'https://graph.hangout.audio/',
          'Accept-Language': 'en-US,en;q=0.5',
        },
        data: `f_p=${encodedPath}&k=${pass}`,
        onload: function (response) {
          if (response.status >= 200 && response.status < 300) {
            try {
              const result = CryptoJSAesJson.decrypt(
                response.responseText,
                pass
              );

              channelFiles.push(result);
              resolve();
            } catch (error) {
              console.error('Error decrypting data for', fileName, error);
              reject(error);
            }
          } else {
            reject(new Error(`HTTP error! status: ${response.status}`));
          }
        },
        onerror: function (error) {
          console.error('Error fetching data via bypass for', fileName, error);
          reject(error);
        },
      });
    });
  }

  function fetchFile(url, channelFiles, fileName) {
    if (url.includes('graph.hangout.audio')) {
      const filePath = extractPathFromUrl(url);
      if (filePath) {
        return fetchHangoutAudio(filePath, channelFiles, fileName);
      }
    }

    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'GET',
        url: url,
        onload: function (response) {
          if (response.status >= 200 && response.status < 300) {
            channelFiles.push(response.responseText);
            resolve();
          } else {
            reject(new Error(`HTTP error! status: ${response.status}`));
          }
        },
        onerror: function (error) {
          console.error('Error fetching data for', fileName, error);
          reject(error);
        },
      });
    });
  }

  async function findFilesInPhoneBook(siteUrl, fileName) {
    const phoneBookUrl = `${siteUrl}data/phone_book.json`;

    try {
      const response = await fetch(phoneBookUrl);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const phoneBook = await response.json();

      for (const entry of phoneBook) {
        for (const phone of entry.phones) {
          if (phone.file instanceof Array) {
            if (phone.file.includes(fileName)) {
              return phone.file;
            }
          } else {
            if (phone.file === fileName) {
              return [phone.file];
            }
          }
        }
      }

      return [];
    } catch (error) {
      console.error('Error fetching or parsing phone_book.json:', error);
      return [];
    }
  }

  async function loadExternalFile(phoneObj, siteUrl, fileName) {
    if (phoneObj.rawChannels) {
      console.log('Data already loaded for:', phoneObj.dispName);
      return; // do nothing if data is already loaded
    }

    const channelFiles = [];
    const promises = [];
    const retryPromises = [];

    for (const channel of ['L', 'R']) {
      const fullFileName = `${fileName} ${channel}.txt`;
      const dataUrl = `${siteUrl}data/${encodeURIComponent(fullFileName)}`;

      const promise = fetchFile(dataUrl, channelFiles, fullFileName).catch(
        (_) => {
          // many headphone squigs rely on a few measurements to get a more accurate average
          // and a number is included in the link, so let's try fetching them
          if (!siteUrl.toLowerCase().includes('/headphones/')) {
            return;
          }

          for (let i = 1; i <= 6; i++) {
            const fullFileName = `${fileName} ${channel}${i}.txt`;
            const dataUrl = `${siteUrl}data/${encodeURIComponent(
              fullFileName
            )}`;

            const promise = fetchFile(dataUrl, channelFiles, fullFileName)
              // we don't care if other requests after it fail, because the number of measurements is not strict
              // 6 is the largest i've seen
              .catch((_) => {});

            retryPromises.push(promise);
          }
        }
      );

      promises.push(promise);
    }

    await Promise.all(promises);
    await Promise.all(retryPromises);

    phoneObj.rawChannels = interpolateData(channelFiles);
  }

  // watch for changes in div#phones
  const observer = new MutationObserver((mutationsList) => {
    for (const mutation of mutationsList) {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach((node) => {
          if (
            node.nodeType === Node.ELEMENT_NODE &&
            node.classList.contains('fauxn-item')
          ) {
            addShowPhoneButton(node, false);
          }
        });
      }
    }
  });

  const phonesDiv = document.querySelector('div#phones');
  if (phonesDiv) {
    observer.observe(phonesDiv, { childList: true, subtree: true });
  } else {
    console.error('Could not find div#phones');
  }
})();
