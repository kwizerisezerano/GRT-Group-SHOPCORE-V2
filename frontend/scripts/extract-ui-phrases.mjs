/* global console, process */

import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const projectRoot = process.cwd();
const sourceRoot = path.join(projectRoot, "src");
const outputPath = path.join(
  sourceRoot,
  "i18n",
  "locales",
  "legacy-ui.en.json",
);

const translatedAttributes = new Set([
  "alt",
  "aria-description",
  "aria-label",
  "placeholder",
  "title",
]);

const translatedProperties = new Set([
  "caption",
  "category",
  "description",
  "detail",
  "emptyText",
  "eyebrow",
  "footerDescription",
  "footerTitle",
  "headline",
  "headerLabel",
  "hint",
  "label",
  "message",
  "name",
  "placeholder",
  "signal",
  "statusLabel",
  "sidebarDescription",
  "sidebarEyebrow",
  "sidebarTitle",
  "subtitle",
  "title",
  "tooltip",
]);

const translatedArrayProperties = new Set([
  "alerts",
  "benefits",
  "branches",
  "features",
  "flows",
  "highlights",
  "items",
  "metrics",
  "products",
  "requirements",
  "steps",
  "workflow",
]);

const callNames = new Set([
  "alert",
  "confirm",
  "Error",
  "toast.error",
  "toast.info",
  "toast.message",
  "toast.success",
  "toast.warning",
]);

const ignoredExact = new Set([
  "ShopCore",
  "EBM",
  "POS",
  "PDF",
  "CSV",
  "Excel",
  "RWF",
  "USD",
  "EUR",
  "QA",
  "API",
  "ID",
  "SKU",
  "VSDC",
]);

const commonLowercaseUiWords = new Set([
  "active",
  "archived",
  "cancelled",
  "completed",
  "failed",
  "healthy",
  "inactive",
  "live",
  "low",
  "now",
  "offline",
  "online",
  "pending",
  "protected",
  "ready",
  "review",
  "syncing",
  "unknown",
]);

function walkFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (["test", "i18n", "integrations"].includes(entry.name)) {
        return [];
      }
      return walkFiles(absolute);
    }
    return /\.(tsx|ts)$/.test(entry.name) ? [absolute] : [];
  });
}

function normalizePhrase(value) {
  const phrase = value.replace(/\s+/g, " ").trim();
  if (!phrase || phrase.length > 500 || ignoredExact.has(phrase)) return null;
  if (!/\p{L}/u.test(phrase)) return null;
  if (/^[.,;:!?'"`()@+*%]/.test(phrase)) return null;
  if (/^(Â|â|ð|ï¿½|\\u)/i.test(phrase)) return null;
  if (phrase.includes("@media") || phrase.includes("visibility:")) return null;
  if (/^(https?:|mailto:|tel:|\/|#)/i.test(phrase)) return null;
  if (
    phrase === phrase.toLowerCase() &&
    /^[a-z0-9_.:/-]+$/.test(phrase) &&
    /[_.:/-]/.test(phrase)
  ) {
    return null;
  }
  if (/(^|\s)(bg|text|border|hover|focus|grid|flex|rounded|shadow)-/.test(phrase)) {
    return null;
  }
  const words = phrase.split(/\s+/);
  const utilityWords = words.filter((word) =>
    /^(?:[a-z]+:)*(?:h|w|min|max|p|px|py|m|mx|my|gap|space|items|justify|overflow|transition|duration|leading|tracking|font|absolute|relative|hidden|block|inline|sm|md|lg|xl)-/.test(
      word,
    ),
  ).length;
  if (words.length > 1 && utilityWords / words.length > 0.35) return null;
  if (/^\d+(px|rem|em|vh|vw|%)$/i.test(phrase)) return null;
  return phrase;
}

function isCodeOnlyString(node) {
  const parent = node.parent;

  if (
    ts.isImportDeclaration(parent) ||
    ts.isExportDeclaration(parent) ||
    ts.isExternalModuleReference(parent)
  ) {
    return true;
  }

  if (
    ts.isJsxAttribute(parent) &&
    ["class", "className", "href", "id", "key", "src", "to", "value"].includes(
      parent.name.text,
    )
  ) {
    return true;
  }

  if (
    ts.isCallExpression(parent) &&
    parent.arguments.includes(node) &&
    ts.isPropertyAccessExpression(parent.expression) &&
    [
      "eq",
      "from",
      "in",
      "like",
      "match",
      "order",
      "select",
      "startsWith",
    ].includes(parent.expression.name.text)
  ) {
    return true;
  }

  return false;
}

function propertyName(node) {
  if (ts.isIdentifier(node) || ts.isStringLiteral(node)) return node.text;
  return "";
}

function expressionText(node) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text;
  }
  return null;
}

function callName(node) {
  if (ts.isIdentifier(node.expression)) return node.expression.text;
  if (
    ts.isPropertyAccessExpression(node.expression) &&
    ts.isIdentifier(node.expression.expression)
  ) {
    return `${node.expression.expression.text}.${node.expression.name.text}`;
  }
  return "";
}

const phrases = new Set();

function add(value) {
  const phrase = normalizePhrase(value);
  if (phrase) phrases.add(phrase);
}

for (const filePath of walkFiles(sourceRoot)) {
  const source = fs.readFileSync(filePath, "utf8");
  const sourceFile = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );

  function visit(node) {
    if (ts.isTemplateExpression(node) && !isCodeOnlyString(node)) {
      const pattern = node.templateSpans.reduce(
        (value, span, index) =>
          `${value}{{${index}}}${span.literal.text}`,
        node.head.text,
      );
      const candidate = normalizePhrase(pattern);
      if (
        candidate &&
        (candidate.includes(" ") || /^\p{Lu}/u.test(candidate))
      ) {
        phrases.add(candidate);
      }
    }

    if (
      (ts.isStringLiteral(node) ||
        ts.isNoSubstitutionTemplateLiteral(node)) &&
      !isCodeOnlyString(node)
    ) {
      const candidate = normalizePhrase(node.text);
      if (
        candidate &&
        (candidate.includes(" ") ||
          /^\p{Lu}/u.test(candidate) ||
          commonLowercaseUiWords.has(candidate.toLowerCase()))
      ) {
        phrases.add(candidate);
      }
    }

    if (ts.isJsxText(node)) {
      add(node.text);
    }

    if (
      ts.isJsxAttribute(node) &&
      translatedAttributes.has(node.name.text) &&
      node.initializer &&
      ts.isStringLiteral(node.initializer)
    ) {
      add(node.initializer.text);
    }

    if (ts.isJsxExpression(node) && node.expression) {
      const ancestor = node.parent;
      const attributeName = ts.isJsxAttribute(ancestor)
        ? ancestor.name.text
        : null;

      if (!attributeName || translatedAttributes.has(attributeName)) {
        const text = expressionText(node.expression);
        if (text) add(text);
      }
    }

    if (ts.isPropertyAssignment(node)) {
      const name = propertyName(node.name);
      const text = expressionText(node.initializer);

      if (text && translatedProperties.has(name)) add(text);

      if (
        translatedArrayProperties.has(name) &&
        ts.isArrayLiteralExpression(node.initializer)
      ) {
        for (const element of node.initializer.elements) {
          const item = expressionText(element);
          if (item) add(item);
        }
      }
    }

    if (ts.isCallExpression(node) && callNames.has(callName(node))) {
      const firstArgument = node.arguments[0];
      if (firstArgument) {
        const text = expressionText(firstArgument);
        if (text) add(text);
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
}

const sorted = [...phrases].sort((a, b) => a.localeCompare(b));
fs.writeFileSync(outputPath, `${JSON.stringify(sorted, null, 2)}\n`, "utf8");
console.log(`Extracted ${sorted.length} UI phrases to ${path.relative(projectRoot, outputPath)}`);
