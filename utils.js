// utils.js
// Requires js-yaml.min.js to be included in manifest and HTML
// https://cdn.jsdelivr.net/npm/js-yaml@4.1.0/dist/js-yaml.min.js
function parseYAML(yamlText) {
  try {
    return jsyaml.load(yamlText);
  } catch (e) {
    console.error("YAML parsing error:", e);
    return null;
  }
}
