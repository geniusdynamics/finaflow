// ABOUTME: Public surface of the shared statement core (types, normalisation, parsing, registry).
// ABOUTME: Deliberately excludes extractors so browser bundles never pull the Node pdf.js build.

export * from "./types";
export * from "./errors";
export * from "./normalize/amount";
export * from "./normalize/date";
export * from "./table/text";
export * from "./parsers/mpesa";
export * from "./parsers/kcb";
export * from "./parsers/registry";
export * from "./categorize/taxonomy";
export * from "./analyze";
export * from "./export/csv";
export * from "./export/json";
