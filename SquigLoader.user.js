// ==UserScript==
// @name         SquigLoader
// @namespace    SquigLoader
// @version      1.0.0
// @description  Load any squig.link measurement from other reviewers on the same graph.
// @author       dov-vai
// @match        https://*.squig.link/*
// @match        https://graph.hangout.audio/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=squig.link
// @grant        none
// @updateURL    https://github.com/dov-vai/SquigLoader/raw/refs/heads/main/SquigLoader.user.js
// @downloadURL  https://github.com/dov-vai/SquigLoader/raw/refs/heads/main/SquigLoader.user.js
// ==/UserScript==

(function() {
    'use strict';
    function addShowPhoneButton(fauxnItem) {
        const addButton = document.createElement('button');
        addButton.textContent = '+';
        addButton.classList.add('add-phone-button');
        let buttonColor = "var(--background-color-contrast-more)"

        // fix for crinacle's site, because the button is invisible
         if (window.location.href.startsWith("https://graph.hangout.audio/")) {
             buttonColor = "var(--background-color-contrast)"
         }

        addButton.style.cssText = `
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

        fauxnItem.appendChild(addButton);

        addButton.addEventListener('click', async (event) => {
            event.preventDefault();
            event.stopPropagation();

            const [brandName, phoneName] = fauxnItem.getAttribute('name').split(': ').map(s => s.trim());
            const fauxnLink = fauxnItem.querySelector('a.fauxn-link');
            const siteUrl = fauxnLink.href.split('/?share=')[0] + '/';
            const fileNames = fauxnLink.href.split('/?share=')[1].split(',');

            let phoneObj = {
                brand: brandName,
                dispBrand: brandName,
                phone: phoneName,
                dispName: phoneName,
                fullName: brandName + " " + phoneName,
                isDynamic: true,
                rawChannels: null,
            };

            try {
                let phoneIndex = allPhones.findIndex(
                    p => p.dispBrand === phoneObj.dispBrand && p.dispName === phoneObj.dispName
                );

                if (phoneIndex === -1) {
                    await externalLoadFiles(phoneObj, siteUrl, fileNames);
                    allPhones.push(phoneObj);
                    showPhone(phoneObj, false);
                    return;
                }
                // if it exists, reference the already created phoneObj
                phoneObj = allPhones[phoneIndex];
                phoneObj.active ? removePhone(phoneObj) : showPhone(phoneObj, false);
            } catch (error) {
                console.error('Error loading data for', phoneName, error);
            }
        });
    }

    async function externalLoadFiles(phoneObj, siteUrl, fileNames) {
        if (phoneObj.rawChannels) {
            console.log("Data already loaded for:", phoneObj.dispName);
            return; // do nothing if data is already loaded
        }

        const channelFiles = [];
        const promises = [];
        const retryPromises = [];

        fileNames.forEach(fileName => {
            fileName = fileName.replace(/_/g, " ");

            for (const channel of ["L", "R"]) {
                const fullFileName = `${fileName} ${channel}.txt`;
                const dataUrl = `${siteUrl}data/${encodeURIComponent(fullFileName)}`;

                const promise = fetch(dataUrl)
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    return response.text();
                })
                .then(data => {
                    channelFiles.push(data);
                })
                .catch(error => {
                    console.error('Error fetching data for', fullFileName, error);

                    // many headphone squigs rely on a few measurements to get a more accurate average
                    // and a number is included in the link, so let's try fetching them
                    if (!siteUrl.toLowerCase().includes("/headphones/")){
                        return;
                    }

                    for (let i = 1; i <= 6; i++){
                        const fullFileName = `${fileName} ${channel}${i}.txt`;
                        const dataUrl = `${siteUrl}data/${encodeURIComponent(fullFileName)}`;

                        const promise = fetch(dataUrl)
                        .then(response => {
                            if (!response.ok) {
                                throw new Error(`HTTP error! status: ${response.status}`);
                            }
                            return response.text();
                        })
                        .then(data => {
                            channelFiles.push(data);
                        })
                        .catch(error => {
                            console.error('Error fetching data for', fullFileName, error);
                        });

                        retryPromises.push(promise);
                    }
                });

                promises.push(promise);
            }
        });

        await Promise.all(promises);
        await Promise.all(retryPromises);

        phoneObj.rawChannels = channelFiles.map(data => {
            if (data) {
                const parsedData = tsvParse(data);
                return Equalizer.interp(f_values, parsedData);
            } else {
                return null;
            }
        }).filter(channel => channel !== null);
    }

    // watch for changes in div#phones
    const observer = new MutationObserver((mutationsList) => {
        for (const mutation of mutationsList) {
            if (mutation.type === 'childList') {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === Node.ELEMENT_NODE && node.classList.contains('fauxn-item')) {
                        addShowPhoneButton(node);
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
