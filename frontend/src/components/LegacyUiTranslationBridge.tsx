import { useEffect } from "react";

import { useLanguage } from "@/contexts/LanguageContext";
import type { AppLanguage } from "@/i18n/types";
import englishPhrases from "@/i18n/locales/legacy-ui.en.json";

type LegacyCatalog = Record<string, string>;

const sourcePhrases = new Set<string>(englishPhrases);
const sourcePatterns = englishPhrases
  .filter((phrase) => /\{\{\d+\}\}/.test(phrase))
  .map((phrase) => {
    const escaped = phrase
      .split(/(\{\{\d+\}\})/g)
      .map((part) =>
        /^\{\{\d+\}\}$/.test(part)
          ? "(.+?)"
          : part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      )
      .join("");

    return {
      source: phrase,
      regex: new RegExp(`^${escaped}$`),
    };
  });
const textSources = new WeakMap<Text, string>();
const textLastApplied = new WeakMap<Text, string>();
const attributeSources = new WeakMap<Element, Map<string, string>>();
const attributeLastApplied = new WeakMap<Element, Map<string, string>>();

const translatedAttributes = [
  "alt",
  "aria-description",
  "aria-label",
  "placeholder",
  "title",
] as const;

function normalize(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function restoreWhitespace(original: string, translated: string) {
  const leading = original.match(/^\s*/)?.[0] ?? "";
  const trailing = original.match(/\s*$/)?.[0] ?? "";
  return `${leading}${translated}${trailing}`;
}

function translatePhrase(
  source: string,
  language: AppLanguage,
  catalog: LegacyCatalog,
) {
  const direct = sourcePhrases.has(source);
  if (direct) {
    return {
      matched: true,
      value: language === "en" ? source : catalog[source] || source,
    };
  }

  for (const pattern of sourcePatterns) {
    const match = source.match(pattern.regex);
    if (!match) continue;

    const template =
      language === "en"
        ? pattern.source
        : catalog[pattern.source] || pattern.source;

    return {
      matched: true,
      value: template.replace(
        /\{\{(\d+)\}\}/g,
        (_, index: string) => match[Number(index) + 1] || "",
      ),
    };
  }

  let matched = false;

  const translatePart = (part: string) => {
    const normalizedPart = normalize(part);
    if (!sourcePhrases.has(normalizedPart)) return part;

    matched = true;
    const translated =
      language === "en"
        ? normalizedPart
        : catalog[normalizedPart] || normalizedPart;

    return restoreWhitespace(part, translated);
  };

  const value = source.replace(
    /[^.!?]+[.!?]+|[^.!?]+$/g,
    (sentence) => {
      const normalizedSentence = normalize(sentence);

      if (sourcePhrases.has(normalizedSentence)) {
        return translatePart(sentence);
      }

      return sentence
        .split(/(\s+[·•]\s+)/g)
        .map(translatePart)
        .join("");
    },
  );

  return { matched, value };
}

function shouldIgnore(element: Element | null) {
  return Boolean(
    element?.closest(
      "script, style, code, pre, textarea, [contenteditable='true'], [data-no-auto-translate]",
    ),
  );
}

async function loadCatalog(language: AppLanguage): Promise<LegacyCatalog> {
  if (language === "en") return {};
  if (language === "fr") {
    return (await import("@/i18n/locales/legacy-ui.fr.json")).default;
  }
  if (language === "rw") {
    return (await import("@/i18n/locales/legacy-ui.rw.json")).default;
  }
  return (await import("@/i18n/locales/legacy-ui.sw.json")).default;
}

function translateTextNode(
  node: Text,
  language: AppLanguage,
  catalog: LegacyCatalog,
) {
  if (shouldIgnore(node.parentElement)) return;

  const current = node.nodeValue ?? "";
  const normalizedCurrent = normalize(current);
  if (!normalizedCurrent) return;

  let source = textSources.get(node);
  const lastApplied = textLastApplied.get(node);

  if (!source && translatePhrase(normalizedCurrent, "en", {}).matched) {
    source = normalizedCurrent;
    textSources.set(node, source);
  }

  if (!source) return;

  const componentUpdatedText =
    current !== lastApplied &&
    normalizedCurrent !== source;

  if (componentUpdatedText) {
    if (sourcePhrases.has(normalizedCurrent)) {
      source = normalizedCurrent;
      textSources.set(node, source);
      textLastApplied.delete(node);
    } else {
      return;
    }
  }

  const translated = translatePhrase(source, language, catalog);
  if (!translated.matched) return;

  const next = restoreWhitespace(current, translated.value);
  if (current !== next) node.nodeValue = next;
  textLastApplied.set(node, next);
}

function translateElementAttributes(
  element: Element,
  language: AppLanguage,
  catalog: LegacyCatalog,
) {
  if (shouldIgnore(element)) return;

  let sources = attributeSources.get(element);
  let lastApplied = attributeLastApplied.get(element);

  if (!sources) {
    sources = new Map();
    attributeSources.set(element, sources);
  }
  if (!lastApplied) {
    lastApplied = new Map();
    attributeLastApplied.set(element, lastApplied);
  }

  for (const attribute of translatedAttributes) {
    const current = element.getAttribute(attribute);
    if (!current) continue;

    const normalizedCurrent = normalize(current);
    let source = sources.get(attribute);
    const previous = lastApplied.get(attribute);

    if (!source && sourcePhrases.has(normalizedCurrent)) {
      source = normalizedCurrent;
      sources.set(attribute, source);
    }

    if (!source) continue;

    if (current !== previous && normalizedCurrent !== source) {
      if (sourcePhrases.has(normalizedCurrent)) {
        source = normalizedCurrent;
        sources.set(attribute, source);
        lastApplied.delete(attribute);
      } else {
        continue;
      }
    }

    const translated = translatePhrase(source, language, catalog);
    if (!translated.matched) continue;

    if (current !== translated.value) {
      element.setAttribute(attribute, translated.value);
    }
    lastApplied.set(attribute, translated.value);
  }
}

function translateTree(
  root: Node,
  language: AppLanguage,
  catalog: LegacyCatalog,
) {
  if (root.nodeType === Node.TEXT_NODE) {
    translateTextNode(root as Text, language, catalog);
    return;
  }

  if (root.nodeType !== Node.ELEMENT_NODE) return;
  const element = root as Element;
  if (shouldIgnore(element)) return;

  translateElementAttributes(element, language, catalog);

  const walker = document.createTreeWalker(
    element,
    NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
  );

  let current = walker.nextNode();
  while (current) {
    if (current.nodeType === Node.TEXT_NODE) {
      translateTextNode(current as Text, language, catalog);
    } else {
      translateElementAttributes(current as Element, language, catalog);
    }
    current = walker.nextNode();
  }
}

export function LegacyUiTranslationBridge() {
  const { language } = useLanguage();

  useEffect(() => {
    let disposed = false;
    let observer: MutationObserver | null = null;

    void loadCatalog(language).then((catalog) => {
      if (disposed) return;

      translateTree(document.body, language, catalog);

      observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          if (mutation.type === "characterData") {
            translateTextNode(mutation.target as Text, language, catalog);
            continue;
          }

          if (mutation.type === "attributes") {
            translateElementAttributes(
              mutation.target as Element,
              language,
              catalog,
            );
            continue;
          }

          for (const node of mutation.addedNodes) {
            translateTree(node, language, catalog);
          }
        }
      });

      observer.observe(document.body, {
        attributes: true,
        attributeFilter: [...translatedAttributes],
        characterData: true,
        childList: true,
        subtree: true,
      });
    });

    return () => {
      disposed = true;
      observer?.disconnect();
    };
  }, [language]);

  return null;
}
