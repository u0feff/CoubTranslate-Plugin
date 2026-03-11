// ==UserScript==
// @name         Coub translate
// @description  Adds button to translate coubs
// @match        *://coub.com/*
// @grant        GM_xmlhttpRequest
// @connect      generativelanguage.googleapis.com
// ==/UserScript==

(function () {
  "use strict";

  const GEMINI_API_KEY = "AIzaSyAVwdfzJeH2oh21WzBY15pueWq6GpTSmbk";
  const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`;

  const TRANSLATION_ENABLED_ATTRIBUTE = "plugin-translation-enabled";
  const TRANSLATED_ATTRIBUTE = "plugin-translated";
  const TRANSLATE_IN_PROGRESS_ATTRIBUTE = "plugin-translate-progress";

  function createStyle() {
    const style = document.createElement("style");

    style.innerHTML = `
    .translateButton {
      height: auto;
      display: block;
      padding: 0;
      border: 0;
      background: none;
      margin: 0;
      cursor: pointer;
    }

    .translateButton svg {
      display: block;
    }

    .translateButton:hover svg path {
      fill: #0332FF;
    }
    `;

    return style;
  }

  function createTranslateButton() {
    const buttonElement = document.createElement("button");

    buttonElement.classList.add("translateButton");

    buttonElement.innerHTML = `
    <i>
      <svg width="24px" height="24px" viewbox="-5 -5 62 62" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          fill-rule="evenodd"
          clip-rule="evenodd"
          d="M39,18.67H35.42l-4.2,11.12A29,29,0,0,1,20.6,24.91a28.76,28.76,0,0,0,7.11-14.49h5.21a2,2,0,0,0,0-4H19.67V2a2,2,0,1,0-4,0V6.42H2.41a2,2,0,0,0,0,4H7.63a28.73,28.73,0,0,0,7.1,14.49A29.51,29.51,0,0,1,3.27,30a2,2,0,0,0,.43,4,1.61,1.61,0,0,0,.44-.05,32.56,32.56,0,0,0,13.53-6.25,32,32,0,0,0,12.13,5.9L22.83,52H28l2.7-7.76H43.64L46.37,52h5.22Zm-15.3-8.25a23.76,23.76,0,0,1-6,11.86,23.71,23.71,0,0,1-6-11.86Zm8.68,29.15,4.83-13.83L42,39.57Z"
          fill="#000000"
        ></path>
      </svg>
    </i>
    `;

    return buttonElement;
  }

  /**
   * @param {Array<String>} textParts
   */
  function translateText(textParts) {
    return new Promise((resolve, reject) => {
      if (
        textParts.every(
          (x) => !x || x.trim() === "" || x.length < 3 || /[а-яА-ЯЁё]/.test(x),
        )
      ) {
        resolve(textParts);
        return;
      }

      let prompt = `Translate text to Russian and write only translation:`;

      for (const part of textParts) {
        prompt += "\n" + part;
      }

      GM_xmlhttpRequest({
        method: "POST",
        url: GEMINI_API_URL,
        headers: { "Content-Type": "application/json" },
        data: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        onload: function (response) {
          const data = JSON.parse(response.responseText);

          if (data.error) {
            reject(`API Error: ${data.error.message || "Unknown API error"}`);
            return;
          }

          console.log("Gemini response", data);

          const parts = data?.candidates[0]?.content?.parts;

          if (!parts) reject("Gemini processing error: no candidates");

          let answer = data.candidates[0].content.parts[0].text.trim();

          answer = answer.replace(
            /^[^a-zA-Zа-яА-ЯЁё0-9]+|[^a-zA-Zа-яА-ЯЁё0-9]+$/g,
            "",
          );

          let answerParts = answer.split("\n");

          while (answerParts.length < textParts.length) answerParts.push("");

          resolve(answerParts);
        },
        onerror: function (error) {
          reject("Gemini API error:" + error);
        },
      });
    });
  }

  /**
   * @param {HTMLElement} coubElement
   */
  function modifyCoub(coubElement) {
    let descriptionOriginalElement = coubElement.querySelector(
      ".coub-description__title .description__title.-original",
    );
    let descriptionTranslationElement = coubElement.querySelector(
      ".coub-description__title .description__title.-translation",
    );

    if (!descriptionOriginalElement) {
      descriptionOriginalElement = coubElement.querySelector(
        ".coub-description__title .description__title",
      );
    }

    if (!descriptionTranslationElement) {
      descriptionTranslationElement =
        descriptionOriginalElement.cloneNode(true);

      descriptionOriginalElement.parentElement.prepend(
        descriptionTranslationElement,
      );

      descriptionOriginalElement.classList.add("-force-hidden");
    } else {
      coubElement.setAttribute(TRANSLATED_ATTRIBUTE, TRANSLATED_ATTRIBUTE);
    }

    descriptionOriginalElement.classList.add("-original");
    descriptionTranslationElement.classList.add("-translation");

    const translateButton = createTranslateButton();

    translateButton.addEventListener("click", async function () {
      if (coubElement.hasAttribute(TRANSLATE_IN_PROGRESS_ATTRIBUTE)) return;

      const isTranslationVisible =
        !descriptionTranslationElement.classList.contains("-force-hidden");

      if (isTranslationVisible) {
        if (coubElement.hasAttribute(TRANSLATED_ATTRIBUTE)) {
          descriptionOriginalElement.classList.remove("-force-hidden");
          descriptionTranslationElement.classList.add("-force-hidden");
        } else {
          coubElement.setAttribute(
            TRANSLATE_IN_PROGRESS_ATTRIBUTE,
            TRANSLATE_IN_PROGRESS_ATTRIBUTE,
          );

          const textElementsMap = [];

          for (const textElement of descriptionTranslationElement.children) {
            textElementsMap.push({
              element: textElement,
              text: textElement.textContent,
            });

            textElement.innerHTML = "";
          }

          textElementsMap[0].element.innerHTML = "Translating...";

          try {
            const translationResult = await translateText(
              textElementsMap.map((x) => x.text),
            );

            for (let i = 0; i < textElementsMap.length; i++) {
              textElementsMap[i].element.innerHTML = translationResult[i];
            }
          } catch (e) {
            textElementsMap[0].element.innerHTML =
              "Error when translating: " + e;
          }

          coubElement.removeAttribute(TRANSLATE_IN_PROGRESS_ATTRIBUTE);
          coubElement.setAttribute(TRANSLATED_ATTRIBUTE, TRANSLATED_ATTRIBUTE);
        }
      } else {
        descriptionTranslationElement.classList.remove("-force-hidden");
        descriptionOriginalElement.classList.add("-force-hidden");
      }
    });

    const buttonsContainerElement = coubElement.querySelector(
      ".coub-description__about__inner > .coub-description__sharing-dropdown",
    ).parentElement;

    buttonsContainerElement.prepend(translateButton);
  }

  /**
   * @param {HTMLElement} rootElement
   */
  function modifyAllCoubs(rootElement) {
    const coubElements = rootElement.querySelectorAll(".coub");

    for (const coubElement of coubElements) {
      if (coubElement.hasAttribute(TRANSLATION_ENABLED_ATTRIBUTE)) continue;

      coubElement.setAttribute(
        TRANSLATION_ENABLED_ATTRIBUTE,
        TRANSLATION_ENABLED_ATTRIBUTE,
      );

      modifyCoub(coubElement);
    }
  }

  document.head.append(createStyle());

  const observer = new MutationObserver(function (mutations) {
    for (const mutation of mutations) {
      for (const element of mutation.addedNodes) {
        if (element.querySelector) modifyAllCoubs(element);
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });

  modifyAllCoubs(document.body);
})();
