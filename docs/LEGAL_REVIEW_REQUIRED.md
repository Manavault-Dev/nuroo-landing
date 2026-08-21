# LEGAL REVIEW REQUIRED

**Status:** Draft — requires review by qualified legal counsel in the Kyrgyz Republic  
**Last updated:** 2026-08-21  
**Author:** Engineering (auto-generated during legal/consent implementation)

This file lists issues found when comparing the current Nuroo product with the attached legal documents. **Do not mark items as resolved without qualified legal sign-off.**

---

## 1. Unfilled placeholders in legal documents

All three attached documents contain unfilled legal placeholders. The documents CANNOT be published or accepted by users in their current state.

**File: Nuroo Publichnaya oferta.pdf**

- Company name: ✅ `ОсОО «Nuroo»` — заполнено
- Legal address: ✅ `г. Бишкек, Парк высоких технологий` — заполнено
- INN: `__________` — требует заполнения после регистрации
- OKPO: `__________`
- Bank account: `__________`
- Bank name + BIC: `__________`
- Email: `__________`
- Phone: `__________`
- Official website: `__________`
- Privacy Policy URL: `__________`
- Effective date: `«___» __________ 2026 г.`
- Approval order number and date: `Приказом ОсОО «__________» № ____ от «___» __________ 2026 г.`

**File: Nuroo Soglasie zakonnogo predstavitelya.pdf**

- Same company placeholders
- Effective date: `«___» _______ 2026 г.`

**ACTION REQUIRED:** Fill all placeholders before publishing any legal document.

---

## 2. Organization / B2B acceptance requires signed "statement of accession"

Per **Public Offer §1.5**, acceptance by a legal entity, individual entrepreneur, or organization (educational, medical, rehabilitation) requires:

> "совершение действий по подписанию заявления о присоединении к настоящей публичной оферте"

This means a **signed document** is legally required — not just an electronic checkbox.

**Current implementation:** Organization onboarding is a checkbox-based flow with no signed accession statement.

**Options (require legal decision):**

1. Amend the Public Offer to allow electronic accession for B2B (most practical for SaaS)
2. Implement e-signature flow for organizations
3. Require upload/confirmation of signed paper document

**ACTION REQUIRED:** Legal must decide and amend the document or define the accession process.

---

## 3. Product description mismatch

The Public Offer and Legal Representative Consent describe Nuroo primarily as:

- A child development platform for children with **special educational needs**
- With **AI-generated screening questionnaires** and **individual developmental programs**
- With **specialist consultations** for parents of children with developmental delays

**Current Nuroo product (2026):**

- B2B platform for specialists and organizations (marketplace, booking, CRM, groups, finances)
- Independent specialists offering services
- Enrollment in programs/groups
- AI Copilot (B2B) and Parent AI (consumer)

**Specific outdated clauses in the Public Offer:**

- §3.2: Lists "screening questionnaires", "AI developmental recommendations", "developmental diary" — these may not exist in the current product
- §2 definitions: "Пользователь" defined only as a parent/legal representative of a child — does not cover specialist or organizational users
- §5.2: "Creating a Child Profile" implies the user is always a parent/legal representative — not applicable to specialists/org admins in B2B
- §4.1–4.4: Medical disclaimer references developmental programs — may not apply to booking/marketplace features

**ACTION REQUIRED:** Legal must revise the Public Offer to reflect the current product scope, including B2B specialist/organization use cases and marketplace/booking functionality.

---

## 4. Legal Representative Consent — physical identity collection

The consent document (Приложение №2) includes physical identity fields:

- Full name, INN/PIN
- Passport series/number/issuer/date
- Home address
- Legal representative status document

**Current implementation:** The web registration and onboarding collect only name, email, and password. Physical identity is not collected.

**Options (require legal decision):**

1. Amend consent form to remove physical identity collection for digital flows (common in SaaS)
2. Implement identity verification step (high friction, likely not appropriate for current product stage)
3. Keep physical fields optional / for future compliance

**Note:** The consent document itself states digital acceptance is valid: "При акцепте в электронной форме подтверждением подписания настоящего согласия является проставление отметки в интерфейсе Приложения с фиксацией даты, времени, идентификатора учётной записи и технических данных сессии в журнале Держателя."

This suggests the electronic checkbox + server-side logging IS the intended digital acceptance mechanism, but the physical fields in the template may be for paper copies.

**ACTION REQUIRED:** Legal must clarify whether digital flow needs to collect any physical identity fields.

---

## 5. Special categories of personal data

The Legal Representative Consent explicitly covers "special categories of personal data" — specifically **health and developmental data** of the child (diagnosis, screening results, specialist conclusions).

Under KR law on personal information, special categories require explicit separate consent and heightened protection.

**Current implementation:** No special-category data handling is explicitly flagged in the codebase. The booking/intake system accepts custom fields that could contain health information.

**ACTION REQUIRED:** Legal/engineering must audit what health/developmental data is actually collected and ensure special-category handling is implemented correctly.

---

## 6. Withdrawal of required consent = service termination

Per consent document §5.3:

> "отзыв согласия в части, необходимой для оказания услуг... влечёт невозможность дальнейшего предоставления доступа к Приложению и прекращение договора"

The engineering implementation provides a withdrawal mechanism in Settings → Privacy. **The UI must clearly communicate** that withdrawing the base required consent terminates the service, not merely limits it.

**Currently:** No withdrawal mechanism exists. Implementation flagged to show a warning before withdrawal.

---

## 7. Re-consent on document update

Per Public Offer §12.2:

> "Продолжение использования Приложения после вступления изменений в силу означает согласие Пользователя с новой редакцией."

This passive acceptance clause means:

- Users notified of changes who continue using the app are deemed to have accepted
- However, for **material changes** to special-category data processing, active re-consent may be required under KR data protection law

**ACTION REQUIRED:** Legal must define which document updates require active re-consent vs. passive acceptance via continued use.

---

## 8. Existing users — unknown consent status

Users registered before this legal/consent system was implemented have **no recorded consent**. Their consent status is `UNKNOWN`.

**Current approach (safe):** Existing users are NOT marked as having accepted. They will be shown a re-consent flow on next login if `requiresReacceptance` is configured on the current document version.

**ACTION REQUIRED:** Legal must decide: should existing users be required to re-consent on next login, or is a notification/banner sufficient?

---

## 9. Transactional vs. marketing communications

Per Public Offer §7.2:

> "направлять Пользователю сервисные (транзакционные) уведомления... — такие уведомления не являются рекламой и направляются без отдельного согласия"

Marketing/promotional communications require separate optional consent (§4.1 of Consent form).

**Current implementation:** The system sends booking confirmations, cancellations, payment notifications — these are transactional and do not require marketing consent. Marketing consent has been implemented as a separate optional checkbox (not pre-checked).

---

## 10. Specialist consent

The Public Offer only defines "Пользователь" as a parent/legal representative. Specialists are mentioned but not defined as a separate contracting party with their own legal relationship.

**ACTION REQUIRED:** Legal must define the legal basis for specialists using Nuroo Business and whether the same Public Offer covers them or a separate B2B agreement is needed.

---

_This document was generated automatically. All items require legal review before production launch._
