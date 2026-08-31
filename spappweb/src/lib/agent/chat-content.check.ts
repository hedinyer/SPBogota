import assert from "node:assert";
import {
  sanitizeHermesMessages,
  toHermesMessages,
  toHermesUserContent,
} from "./chat-content.ts";

assert.equal(toHermesUserContent("hola"), "hola");
assert.equal(toHermesUserContent("  hola  "), "hola");

const withDoc = toHermesUserContent("mira", [
  { name: "nota.txt", mime: "text/plain", text: "linea 1" },
]);
assert.equal(typeof withDoc, "string");
assert.ok(String(withDoc).includes("linea 1"));
assert.ok(String(withDoc).includes("nota.txt"));

const withPdf = toHermesUserContent("lee esto", [
  {
    name: "cedula.pdf",
    mime: "application/pdf",
    url: "https://example.com/cedula.pdf",
  },
]);
assert.equal(typeof withPdf, "string");
assert.ok(String(withPdf).includes("https://example.com/cedula.pdf"));

const withImg = toHermesUserContent("qué ves", [
  {
    name: "foto.jpg",
    mime: "image/jpeg",
    url: "https://cdn.example.com/foto.jpg",
  },
]);
assert.ok(Array.isArray(withImg));
assert.equal(withImg[0].type, "text");
assert.equal(withImg[1].type, "image_url");
if (withImg[1].type === "image_url") {
  assert.equal(withImg[1].image_url.url, "https://cdn.example.com/foto.jpg");
}

const onlyImg = toHermesUserContent("", [
  {
    name: "x.png",
    mime: "image/png",
    url: "https://cdn.example.com/x.png",
  },
]);
assert.ok(Array.isArray(onlyImg));
assert.equal(onlyImg[0].type, "text");
assert.ok(onlyImg[0].type === "text" && onlyImg[0].text.includes("x.png"));

const packed = toHermesMessages([
  { role: "user", content: "hola" },
  { role: "assistant", content: "listo" },
]);
assert.equal(packed[0].content, "hola");
assert.equal(packed[1].content, "listo");

const clean = sanitizeHermesMessages([
  { role: "system", content: "nope" },
  { role: "user", content: "ok" },
  {
    role: "user",
    content: [
      { type: "text", text: "foto" },
      { type: "image_url", image_url: { url: "https://x.test/a.jpg" } },
      { type: "image_url", image_url: { url: "data:image/png;base64,xx" } },
      { type: "file", file: { filename: "x.pdf" } },
    ],
  },
  { role: "assistant", content: "" },
]);
assert.equal(clean.length, 2);
assert.equal(clean[0].content, "ok");
assert.ok(Array.isArray(clean[1].content));
assert.equal((clean[1].content as { type: string }[]).length, 2);

assert.deepEqual(sanitizeHermesMessages(null), []);
assert.deepEqual(sanitizeHermesMessages("x"), []);

console.log("chat-content.check OK");
