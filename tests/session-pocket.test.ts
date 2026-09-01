import test from "node:test"
import assert from "node:assert/strict"

import { parseUrl, getApexDomain, getWebsiteDisplayName } from "../src/lib/domain.ts"
import { SessionPocketSchema, ExportDataSchema, PocketSettingsSchema } from "../src/lib/schema.ts"

test("Domain Utilities - parseUrl", () => {
  // WhatsApp Web
  const wa = parseUrl("https://web.whatsapp.com/")
  assert.equal(wa.isValid, true)
  assert.equal(wa.domain, "web.whatsapp.com")
  assert.equal(wa.apexDomain, "whatsapp.com")
  assert.equal(wa.origin, "https://web.whatsapp.com")

  // YouTube with query params
  const yt = parseUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")
  assert.equal(yt.isValid, true)
  assert.equal(yt.domain, "www.youtube.com")
  assert.equal(yt.apexDomain, "youtube.com")

  // Second-level TLDs (e.g. .co.uk)
  const uk = parseUrl("https://subdomain.service.co.uk/account")
  assert.equal(uk.isValid, true)
  assert.equal(uk.domain, "subdomain.service.co.uk")
  assert.equal(uk.apexDomain, "service.co.uk")

  // Invalid chrome:// URLs
  const chromeUrl = parseUrl("chrome://extensions")
  assert.equal(chromeUrl.isValid, false)

  // Edge / file URLs
  const fileUrl = parseUrl("file:///home/user/test.html")
  assert.equal(fileUrl.isValid, false)
})

test("Domain Utilities - getWebsiteDisplayName", () => {
  assert.equal(getWebsiteDisplayName("web.whatsapp.com", "whatsapp.com"), "WhatsApp")
  assert.equal(getWebsiteDisplayName("www.instagram.com", "instagram.com"), "Instagram")
  assert.equal(getWebsiteDisplayName("www.youtube.com", "youtube.com"), "YouTube")
  assert.equal(getWebsiteDisplayName("app.customservice.io", "customservice.io"), "Customservice")
})

test("Schema Validation - SessionPocketSchema", () => {
  const validSession = {
    id: "pocket_12345",
    name: "Work Account",
    tag: "indigo",
    url: "https://web.whatsapp.com/",
    domain: "web.whatsapp.com",
    apexDomain: "whatsapp.com",
    origin: "https://web.whatsapp.com",
    createdAt: Date.now(),
    lastUsedAt: Date.now(),
    lastSavedAt: Date.now(),
    cookies: [
      {
        name: "wa_auth",
        value: "token_abc_123",
        domain: ".whatsapp.com",
        path: "/",
        secure: true,
        httpOnly: true,
        sameSite: "lax"
      }
    ],
    storage: {
      localStorage: { user_id: "usr_42" },
      sessionStorage: {}
    }
  }

  const result = SessionPocketSchema.safeParse(validSession)
  assert.equal(result.success, true)

  // Missing required field: name
  const invalidSession = { ...validSession, name: "" }
  const invalidResult = SessionPocketSchema.safeParse(invalidSession)
  assert.equal(invalidResult.success, false)
})

test("Schema Validation - ExportDataSchema", () => {
  const validExport = {
    format: "sessionpocket-backup",
    version: 1,
    exportedAt: Date.now(),
    sessions: [
      {
        id: "pocket_test_1",
        name: "Personal Instagram",
        tag: "rose",
        url: "https://www.instagram.com/",
        domain: "www.instagram.com",
        apexDomain: "instagram.com",
        origin: "https://www.instagram.com",
        createdAt: 1700000000000,
        lastUsedAt: 1700000000000,
        lastSavedAt: 1700000000000,
        cookies: [],
        storage: { localStorage: {}, sessionStorage: {} }
      }
    ],
    settings: {
      theme: "dark",
      autoSyncOnSwitch: true,
      confirmBeforeDelete: true,
      showActiveBadge: true
    }
  }

  const exportResult = ExportDataSchema.safeParse(validExport)
  assert.equal(exportResult.success, true)

  // Invalid backup format header
  const invalidFormat = { ...validExport, format: "wrong-format" }
  const invalidFormatResult = ExportDataSchema.safeParse(invalidFormat)
  assert.equal(invalidFormatResult.success, false)
})

test("Schema Validation - PocketSettingsSchema defaults", () => {
  const defaultSettings = PocketSettingsSchema.parse({})
  assert.equal(defaultSettings.theme, "dark")
  assert.equal(defaultSettings.autoSyncOnSwitch, true)
  assert.equal(defaultSettings.confirmBeforeDelete, true)
  assert.equal(defaultSettings.showActiveBadge, true)
})
