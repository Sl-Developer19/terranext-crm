# TerraNext Business OS
## Complete User Manual

**A step-by-step guide to using the TerraNext CRM — written for everyone, no computer experience required.**

Prepared for: TerraNext Global Ventures — Management & Staff
Document Type: Enterprise User Manual
Confidentiality: Internal Use Only

---

### Document Version

| Field | Detail |
|---|---|
| Document Title | TerraNext Business OS — User Manual |
| Version | 1.2 |
| Status | Final — Production Release |
| Date Issued | 11 August 2026 |
| Prepared By | Technical Documentation Team |
| Applies To | TerraNext CRM (Staff Application) + Growth Partner Portal + Public Website (verified against both the CRM and the separate public-website codebases) |

### Revision History

| Version | Date | Author | Description of Change |
|---|---|---|---|
| 1.0 | 02 August 2026 | Technical Documentation Team | First edition. Describes the CRM exactly as it exists in production at the time of writing. |
| 1.1 | 08 August 2026 | Technical Documentation Team | Re-verified every claim against the live source code of both the CRM and the separate public-website repository. Corrected the description of Growth Partner Leadership Levels (they are organisation-defined tiers, not a fixed Bronze/Silver/Gold/Platinum scale, and are editable); completed the Settings chapter with the previously-missing Branding and Leadership Levels sections and two missing ID-format fields; corrected several public-website form details (academy names, one business category label, pop-up button labels) and added the dynamic-with-fallback nature of the Academy list; added a new NextStep chapter documenting its actual (unbuilt) state; added a new Website & CRM Integration chapter; expanded the Troubleshooting Guide into named categories including QR, certificate, email, and referral issues; split the Daily Checklist into Daily/Weekly/Monthly and separated the Trainer checklist from Programme Coordinator; added a Quick Start Guide, Glossary, and Index; added screenshot placeholders throughout every module chapter. |
| 1.2 | 11 August 2026 | Technical Documentation Team | Re-checked against the live source code following a fix to the Growth Community Business self-service Profile/Dashboard (Chapter 40 previously warned this page "may appear blank" for business partners — this is now corrected and working). Corrected Chapter 41 (Partner QR Code), which incorrectly stated only Growth Community Business partners have a QR code — individual Growth Partners have always had one too, both self-service (Chapter 41) and from their staff-side profile (added as a new step to Chapter 23). Documented the new staff-facing **Resend Access Email** action on both the Growth Partners (Chapter 23) and Growth Community Business (Chapter 24) profile screens, including its rate limit and its "no duplicate account, no plaintext password" guarantees; added it to the Glossary and Index. Fixed two stale Index page references (ID Formats, Branding Settings) that pointed to Chapter 33 (Audit Logs) instead of Chapter 34 (Settings), where those sections actually live. |

> **Note — how this manual stays accurate:** This manual describes only what is actually built and working in the CRM today. If a future update adds new buttons, screens, or removes something described here, this manual should be updated at the same time so it never falls out of step with the real system.

---

## Table of Contents

**Part 1 — Getting Started**
1. Introduction
2. System Overview
3. Navigation Guide
4. Understanding Roles & Permissions
5. Signing In & Account Security

**Part 2 — Acquisition (Turning Enquiries into Students)**
6. Dashboard
7. Leads
8. Counselling
9. Admissions
10. Parents & Families
11. Colleges

**Part 3 — Academics (Running the Programmes)**
12. Participants
13. Programmes & Academies
14. Batches
15. Attendance
16. Assessments
17. Certificates

**Part 4 — Career & Alumni**
18. Career Interest
19. Placements
20. Employers
21. Alumni
22. NextStep

**Part 5 — Growth Partner Management**
23. Growth Partners
24. Growth Community Business
25. Reward Rules
26. Payouts

**Part 6 — Operations**
27. Fees & Collections
28. Communications
29. Reports
30. Staff Notifications (What Exists Today)

**Part 7 — Administration**
31. Users
32. Roles & Permissions (Admin Screen)
33. Audit Logs
34. Settings

**Part 8 — The Growth Partner Portal**
35. Partner Login
36. Partner Dashboard
37. My Leads (Partner Portal)
38. My Rewards (Partner Portal)
39. Partner Notifications
40. Partner Profile
41. Partner QR Code

**Part 9 — The Public Website**
42. Student Application Form
43. Contact Form & Application Pop-up
44. Growth Partner Registration (Public)
45. Growth Community Business Registration (Public)
46. Referral Links & QR Scans
47. Website & CRM Integration

**Part 10 — Reference**
48. Workflow Diagrams (All Modules)
49. Troubleshooting Guide
50. Frequently Asked Questions
51. Operating Checklists (Daily / Weekly / Monthly)
52. Best Practices Summary
53. Support Contact

**Back Matter**
Glossary
Index

---

## Quick Start Guide

New here? Read this two-minute page first — it points you straight to what matters for your role, instead of reading fifty-plus chapters in order.

> **Before anything else:** you need an account. There is no self-registration — a System Administrator creates it for you and sends you a link to set your password. If you don't have that yet, stop here and ask them (see Chapter 31).

### Your first day, by role

| Your role | Read these chapters first | Then explore |
|---|---|---|
| **Founder** | 4 (Roles), 6 (Dashboard), 47 (Website & CRM Integration) | Skim every Part to understand the whole system; Chapter 52 (Best Practices) |
| **System Administrator** | 5 (Sign In), 31 (Users), 34 (Settings), 33 (Audit Logs) | Chapter 32 (Roles & Permissions, read-only reference) |
| **Operations Manager** | 7 (Leads), 8 (Counselling), 9 (Admissions), 6 (Dashboard) | 11 (Colleges), 23/24 (Partners), 29 (Reports) |
| **Transformation Consultant** | 7 (Leads), 8 (Counselling) | 10 (Parents & Families) |
| **Programme Coordinator** | 13 (Programmes), 14 (Batches), 17 (Certificates) | 15 (Attendance), 16 (Assessments) |
| **Trainer** | 15 (Attendance), 16 (Assessments) | 14 (Batches, Roster/Sessions tabs) |
| **Finance Officer** | 27 (Fees & Collections) | 26 (Payouts) |
| **Career & Placement Officer** | 18 (Career Interest), 19 (Placements) | 20 (Employers) |
| **Growth Partner / Community Business** (Partner Portal) | 35 (Partner Login), 36 (Partner Dashboard), 37 (My Leads) | 38 (My Rewards), 40 (Partner Profile) |

### The five things every role should know before doing anything else

1. **Your menu shows only what you're allowed to use.** A missing button or module almost always means a permission boundary, not a fault — Chapter 4.
2. **Nothing important is ever truly deleted.** Records are hidden ("soft-deleted") or corrected with a new entry, never silently erased — this protects everyone, including you.
3. **Every meaningful action is logged**, permanently, with your name and the exact time — Chapter 33.
4. **If something looks wrong, ask — don't work around it.** Sharing a login, guessing a permission workaround, or forcing a mistake through creates problems that are hard to undo later.
5. **This manual is written to match the live system exactly.** If something you see doesn't match what's described here, tell your System Administrator — the manual (or the system) needs updating.

---

# Part 1 — Getting Started

## 1. Introduction

### Purpose

This manual teaches every TerraNext Global Ventures staff member, manager, and growth partner how to use the TerraNext CRM ("the system") — step by step, in plain English. You do not need any technical background to use this manual. If you can use a smartphone or send a WhatsApp message, you can use this system.

### Who should use this manual

Everyone who touches the system:
- Founders and senior management
- Operations Managers
- Transformation Consultants (counselling and enquiries)
- Programme Coordinators and Trainers
- Finance Officers
- Career & Placement Officers
- System Administrators
- Growth Partners and Community Business partners (referral partners, using the separate Partner Portal)

### How to use this manual

- Find your role in **Chapter 4 — Understanding Roles & Permissions** to see exactly which chapters matter most to you.
- Each chapter covers one screen or feature ("module") of the CRM.
- Every module chapter follows the same layout: **Purpose**, **Who should use it**, **What it does**, **Step-by-step instructions**, **Expected result**, **Notes**, **Common mistakes**, **Best practices**, and **FAQs** — so once you learn the pattern, every chapter reads the same way.
- Throughout this manual, look for three kinds of callout boxes: **Note** (extra background information), **Warning** (something that cannot be undone or needs extra care), and **Tip** (a suggestion that makes the task easier). They are formatted as indented quote blocks so they stand out from the numbered steps.
- If a feature is described elsewhere as "coming soon" or is not yet available, this manual says so honestly rather than describing something you cannot actually click on.

### A note on honesty in this manual

This manual was written by inspecting the live CRM system screen by screen, button by button. It documents **only what exists today**. A few things you may have heard about (for example, a search box on every list, or a chart-based dashboard) are **not yet built** — where that is the case, this manual tells you plainly, so you are never confused about why you cannot find something.

---

## 2. System Overview

### What is the TerraNext CRM?

The TerraNext CRM ("Business OS") is the single system TerraNext Global Ventures uses to run its transformation academies from end to end — from the first time someone enquires about a programme, all the way through counselling, admission, training, certification, and even placement and alumni relationships afterwards.

Think of it as one shared notebook for the whole organisation, except:
- Everyone sees the same, always up-to-date information.
- Only people who need to see or change something are allowed to.
- Every important action is written down automatically, so there is always a record of who did what and when.

### The three parts of the system

| Part | Who uses it | How to reach it |
|---|---|---|
| **1. The CRM (Staff Application)** | TerraNext employees — founders, managers, consultants, coordinators, trainers, finance officers, placement officers, system administrators | A private web address, reached only after signing in with a staff account |
| **2. The Growth Partner Portal** | External referral partners — individuals ("Growth Partners") and businesses ("Growth Community Business" partners) who refer people to TerraNext and earn rewards | A separate private web address, reached only after signing in with a partner account |
| **3. The Public Website** | Anyone on the internet — prospective students, parents, businesses wanting to partner with TerraNext | The public TerraNext website — no sign-in required |

These three parts talk to each other automatically. For example, when someone fills in the "Apply Now" form on the public website, a new **Lead** instantly appears in the CRM for a Transformation Consultant to follow up on — nobody has to retype anything.

### The lifecycle this system manages

```
Public enquiry / referral
        ↓
     Lead
        ↓
   Counselling
        ↓
   Admission
        ↓
  Participant (enrolled learner)
        ↓
Batches → Attendance → Assessments
        ↓
    Certificate
        ↓
Career Interest → Placement
        ↓
      Alumni
```

Money (Fees), messages (Communications), referral rewards (Growth Partners), and record-keeping (Reports, Audit Logs) run alongside this main journey at every stage.

---

## 3. Navigation Guide

### Signing in

Every staff member reaches the CRM through the **Sign in** page. There is **no self-registration** — you cannot create your own account. A System Administrator must create it for you first (see Chapter 31 — Users).

### The screen layout, once signed in

Once you sign in, every screen in the CRM has the same three parts:

1. **Left-hand sidebar** — your menu. It lists only the modules **you** are allowed to use; anything you don't have permission for is simply not shown, so your menu will look different from a colleague's in a different role.
2. **Top header** — shows your name and a **Sign out** button.
3. **Main area** — the actual screen content: tables, forms, and buttons.

[SCREENSHOT – CRM Layout, Sidebar and Header Labelled]

### The menu groups, in order

| Group | Contains |
|---|---|
| *(top, no heading)* | Dashboard |
| **Acquisition** | Leads, Counselling, Admissions, Parents & Families, Colleges |
| **Academics** | Participants, Programmes, Batches, Attendance, Assessments, Certificates |
| **Career** | Career Interest, Placements, Employers, Alumni |
| **Growth Partners** | Partners, Growth Community Business, Reward Rules, Payouts |
| **Operations** | Fees & Collections, Communications, Reports |
| **Administration** | Users, Roles & Permissions, Audit Logs, Settings |

Only menu items your role is allowed to see will appear — this is explained fully in the next chapter.

### Signing out

Click **Sign out** at any time (top of the screen) to end your session safely. Always sign out if you are stepping away from a shared or public computer.

### Automatic screen lock

If you leave the CRM open without touching it for a while, a **"Session locked"** screen will cover the page. You cannot dismiss it by clicking away — you must type your password again to continue. This protects your account if you walk away from your desk without signing out. Nothing you were doing is lost; you simply re-enter your password and continue exactly where you left off.

[SCREENSHOT – Session Locked Screen]

---

## 4. Understanding Roles & Permissions

### Purpose

The CRM gives every staff member a **role**. Your role decides exactly what you can see and do — nothing more, nothing less. This chapter explains the eight roles in plain English so you understand why your screen looks the way it does.

### Who should read this chapter

Everyone. Understanding your own role — and the roles of the colleagues you work with — helps you understand why, for example, only a Founder or Operations Manager can approve a discount, or why a Trainer only sees their own batches.

### The eight roles

| Role | In plain English |
|---|---|
| **Founder & Proprietor** | Can see and do everything in the entire system, with no restrictions. |
| **System Administrator** | Runs the technical side: creates staff accounts, manages roles, watches the audit trail, edits organisation settings. Does not approve business decisions like discounts or admissions. |
| **Operations Manager** | Runs day-to-day CRM operations broadly — leads, admissions, batches, discount approvals, partner approvals, and more. |
| **Transformation Consultant** | Handles enquiries and counselling — creates and works leads, records counselling sessions. |
| **Programme Coordinator** | Runs the academic side — programmes, batches, attendance rules, assessments, certificate eligibility checks. |
| **Trainer** | Sees and manages only the batches they are personally assigned to teach — marks attendance, enters scores for their own students. |
| **Finance Officer** | Handles money — records payments, issues receipts, reverses incorrect entries. Cannot approve their own discounts. |
| **Career & Placement Officer** | Manages career readiness, placements, and employer relationships. |

### How permissions work, in plain English

For every part of the system (a "module," such as Leads or Fees), a role can be given one or more of these abilities:

- **View** — look at the information
- **Create** — add new records
- **Update** — edit existing records
- **Delete** — remove a record (this never truly erases it — see the note below)
- **Assign** — hand a record to someone else (e.g. assign a lead to a consultant)
- **Approve** — sign off on something sensitive (e.g. a fee discount, a partner application)
- **Export** — download data out of the system
- **Configure** — change system-level settings for that module

> **Note — nothing is ever truly erased:** When something is "deleted" in this CRM (a lead, a message), it is only hidden from view — the underlying record is kept safely so that history and audit trails are never lost. Only a Founder or System Administrator can perform this kind of hide-and-keep deletion, and it is always recorded.

### What this means for you day to day

- If a button you expect to see is missing, it is almost always because your role does not have permission for that action — this is normal and by design, not a fault.
- If you believe you need access to something you cannot see, contact your System Administrator (Chapter 31) or Founder.
- The full technical permission matrix (every role × every module) is visible on-screen to Founders and System Administrators at **Administration → Roles & Permissions** (Chapter 32).

### Common mistakes

> **Warning:** Assuming a missing button is a bug — usually it is simply a permission boundary.

> **Warning:** Asking a colleague to perform an action "on your behalf" using their own login — every action is tied to the person who is actually signed in, so this creates a misleading audit trail. Always ask a System Administrator to adjust your permissions properly instead.

### Frequently Asked Questions

**Q: Can two people have the same role?**
A: Yes. Any number of staff can share a role (for example, several Trainers).

**Q: Can my role be changed?**
A: Yes, only by a System Administrator or Founder, from the Users screen (Chapter 31). You cannot change your own role.

**Q: Why can't I see a module my colleague sees?**
A: Your roles are different, or your role does not include that module. This is expected, not an error.

---

## 5. Signing In & Account Security

### Purpose

This chapter covers everything about getting into the CRM safely: signing in, what happens if you forget your password, resetting your password, and signing out.

### Who should use this

Every staff member, every time they start work.

### What this module does

Controls secure entry to the CRM using an email address and password. There is no self-registration button anywhere — every account is created for you by a System Administrator.

### Step-by-step: Signing in

1. Open the CRM sign-in page.
2. Type your work **email address** into the Email box.
3. Type your **password** into the Password box.
4. Click **Sign in**.
5. If your details are correct, you are taken straight to your **Dashboard**.

[SCREENSHOT – Sign In Page]

### Expected result

You land on the Dashboard, and your name appears in the top-right of the screen.

### Step-by-step: If you forget your password

1. On the sign-in page, click **Forgot password?**
2. Type your work email address.
3. Click **Send reset link**.
4. You will see a message confirming a link has been sent — this message appears **whether or not** an account exists for that email, for security reasons, so don't worry if you're not 100% sure which email your account uses.
5. Check your email inbox for a message with a password reset link. **The link expires in 1 hour and can only be used once.**
6. Click the link in the email. You will land on the **Set a new password** screen.
7. Type a new password. It must be **at least 10 characters long and include at least one letter and one number**.
8. Type the same password again to confirm it.
9. Click **Reset password**.
10. You will see a confirmation message, then be sent back to the sign-in page to log in with your new password.

[SCREENSHOT – Forgot Password Page]

### Step-by-step: Signing out

1. Click **Sign out** at the top of any screen.
2. You are returned to the sign-in page.

### What happens if you type the wrong password too many times

For your protection, the system temporarily locks your account after repeated failed sign-in attempts:

| Failed attempts | What happens |
|---|---|
| 3 in a row | Locked for 30 seconds |
| 5 in a row | Locked for 5 minutes |
| 10 in a row | Locked for 30 minutes, and this is flagged for review |

A successful sign-in immediately clears this counter. The screen will show you a countdown while locked.

### Important notes

> **Warning:** Error messages deliberately do **not** tell you whether the problem was the email or the password — this is a security feature, not a bug, so that someone trying to guess your login cannot learn which part they got right.

> **Note:** There is currently **no additional sign-in step (such as a phone code or authenticator app) available to set up** — the CRM's sign-in relies on your email and password only, so keep your password private and unique to this system.

> **Note:** Your sign-in session lasts up to 5 days before you need to sign in again, but the automatic screen lock (Chapter 3) will still protect an idle, unattended screen sooner than that.

### Common mistakes

> **Warning:** Typing your password with Caps Lock on by accident.

> **Warning:** Repeatedly retrying a wrong password quickly, which triggers a lockout — if you're unsure of your password, use **Forgot password?** instead of guessing.

> **Warning:** Sharing your password with a colleague "just this once" — this is against policy; ask a System Administrator to set the colleague up with their own account instead.

### Best practices

> **Tip:** Use **Forgot password?** the moment you suspect you've forgotten your password, rather than guessing repeatedly.

> **Tip:** Always click **Sign out** on shared computers.

> **Tip:** Choose a password that is not used anywhere else.

### Frequently Asked Questions

**Q: I never received the password reset email. What do I do?**
A: Check your spam/junk folder first. If it's genuinely not arriving after a few minutes, ask your System Administrator to check your email address is correct on your account, or to issue you a fresh account link.

**Q: My reset link says it's invalid.**
A: Reset links expire after 1 hour and can only be used once. Request a new one from the Forgot Password screen.

**Q: Can I set up fingerprint or face sign-in?**
A: Not at this time — this feature does not currently exist in the CRM.

**Q: The screen suddenly shows "Session locked" — did I do something wrong?**
A: No — this happens automatically after a period of inactivity, to protect your account. Simply type your password again to continue.

---

# Part 2 — Acquisition (Turning Enquiries into Students)

## 6. Dashboard

### Purpose

The Dashboard is your homepage after signing in. It shows a quick numbers-only snapshot of how the business is performing, scoped to what is relevant to your role.

### Who should use this module

Everyone — every role sees a Dashboard, but the specific numbers shown differ by role.

### What this module does

Shows a set of "stat tiles" (small boxes with a number and a label) grouped into named sections. The figures are calculated live, fresh, every time you open the page — they are never stale or cached.

### Step 1
Sign in. You are taken to the Dashboard automatically.

[SCREENSHOT – Dashboard Page]

### Step 2
Read the subtitle under the page title — it shows your role and the exact time the figures were calculated.

### Step 3
Scroll through the sections relevant to your role (see table below).

### Step 4
Click any module in the left sidebar to go and act on what you've seen (e.g. seeing a high number of pending fees might send you to Fees & Collections).

### Which sections each role sees

| Role | Sections shown |
|---|---|
| Founder | Acquisition, Academic Delivery, Outcomes, Finance, Partner Network |
| Operations Manager | Acquisition, Academic Delivery, Outcomes, Partner Network |
| System Administrator | Academic Delivery, Partner Network |
| Transformation Consultant | Acquisition |
| Programme Coordinator | Academic Delivery |
| Trainer | Academic Delivery |
| Finance Officer | Finance, Partner Network |
| Career & Placement Officer | Outcomes |

### What each section shows

- **Acquisition:** total enquiries, counselling appointments, admissions, admissions this month, enquiry-to-admission rate, parent conversion rate.
- **Academic Delivery:** active participants, active batches, average attendance, assessment completion rate, programme completion rate, trainer utilisation.
- **Outcomes:** certificates issued, alumni count (and how many joined this month), placement rate, participant satisfaction, operational compliance.
- **Finance:** revenue collected, outstanding fees, collection rate.
- **Partner Network:** total partners, active Growth Partners, active Community Business partners, referrals, qualified referrals, converted referrals, referral conversion rate, rewards generated/paid/pending, wallet balance.

### Expected result

A quick, honest snapshot of the numbers relevant to your job, refreshed every time you load the page.

### Important notes

> **Warning:** A dash ("—") on a tile is not a zero. It means that particular figure cannot be measured yet because the underlying feature isn't built or no data exists — the system deliberately shows "unavailable" rather than a misleading "0". Today this applies to Placement rate, Participant satisfaction, and Operational compliance.

> **Note:** Some figures are marked "based on a limited scan" — this happens automatically if the organisation's records grow very large; it does not affect day-to-day accuracy but means the true figure could be marginally different once records exceed a very large volume.

> **Warning:** The Dashboard currently shows numbers only — there are no charts or graphs, and no "today's tasks" or "follow-ups due" lists. If you were expecting a visual chart or a personal task list here, that feature does not exist yet; use the individual modules (Leads, Fees, etc.) for day-to-day task lists.

### Common mistakes

> **Warning:** Treating a dash ("—") tile as "zero performance" — it actually means "not measurable yet," which is different.

> **Warning:** Expecting to click on a Dashboard tile to drill into detail — tiles are not currently clickable; use the sidebar to navigate to the relevant module instead.

### Best practices

> **Tip:** Check your Dashboard first thing each day as a quick pulse-check, then use the sidebar to act on anything that needs attention.

> **Tip:** Compare figures day-to-day rather than reacting to a single number in isolation.

### Frequently Asked Questions

**Q: Why does my Dashboard look different from a colleague's?**
A: Dashboards are role-scoped — see the table above.

**Q: Can I customise which tiles I see?**
A: No, tiles are fixed per role and cannot currently be personalised.

**Q: The numbers seem out of date.**
A: They shouldn't be — figures are calculated fresh on every page load, with no caching. Try refreshing your browser.

---

## 7. Leads

### Purpose

A **Lead** is any enquiry about TerraNext — from the website, a phone call, a walk-in, a referral, a college, a campaign, or social media. This is where every enquiry starts its journey.

### Who should use this module

Transformation Consultants (create, update, work leads), Operations Managers and Founders (full access, including assigning and exporting), System Administrators (view and delete only).

### What this module does

Lists every enquiry, tracks its progress through a pipeline of stages, and lets staff log calls, notes, and follow-ups against each one.

### Step 1 — Open Leads
Click **Leads** in the Acquisition menu group. You'll see a table of every lead you're allowed to see. *(Transformation Consultants only see leads assigned to them; Operations Managers and Founders see everyone's leads.)*


[SCREENSHOT – Leads]

### Step 2 — Create a new lead (walk-in, phone call, etc.)
Click **New lead** (top right — only visible if you have permission to create leads).
Fill in the form:
- **Name** (required)
- **Phone** (required, in international format, e.g. `+919876543210`)
- **Email** (optional)
- **Source** — choose Website, Campaign, Referral, College, Walk-in, or Social media (required, defaults to Walk-in)
- **Programme interest** (optional free text)
- Tick the **consent checkbox** confirming the person agreed to be contacted (required — you cannot create a lead without this)
Click **Create lead**.


[SCREENSHOT – Leads, Create a new lead]

### Step 3 — Open a lead's record
Click any lead's name in the list to open its detail page. Here you can see all contact details, its pipeline stage, who it's assigned to, and its full activity history.

### Step 4 — Log an activity (call, note, or follow-up)
On the lead's detail page, fill in the activity box:
- **Type** — Call, Note, or Follow-up
- **Next follow-up** (optional date/time)
- **Summary** (required — what happened)
Click **Log activity**.

### Step 5 — Change the pipeline stage
Use the **Stage** dropdown on the lead's detail page to move it forward (e.g. from "New" to "Contacted"). This saves immediately — there is no separate save button.

### Step 6 — Assign a lead to a consultant *(Operations Managers/Founders only)*
Use the **Assigned to** dropdown on the lead's detail page to hand the lead to a specific Transformation Consultant, or leave it "Unassigned."

### Expected result

Every enquiry has one, permanent, trackable record — with a full history of every call, note, and stage change, and a clear owner.

### The pipeline stages, explained

| Stage | Meaning |
|---|---|
| New | Just created, not yet contacted |
| Contacted | Someone has reached out |
| Counselling booked | A counselling session is scheduled |
| Counselling attended | A counselling session has happened |
| Hot | Strong candidate, ready to move toward admission |
| Admitted | Successfully converted into a student (Participant) |
| Follow-up | Needs another touch-point before deciding |
| Lost | Enquiry did not proceed |

Some stage changes happen automatically — for example, recording a counselling session that recommends the person moves the lead to "Hot" automatically.

### Important notes

> **Warning:** Duplicate leads are never blocked. If you create a lead with a phone number that already exists, the system still creates it and simply warns you — TerraNext's policy is that no enquiry is ever silently lost, even if it means occasional duplicates to clean up manually.

> **Note:** There is currently **no search box or filter controls** on the Leads list and **no kanban/board view** — it is a straightforward table only, capped at showing the most recent 500 leads.

> **Warning:** Only a Founder or System Administrator can delete a lead, and it is a "soft" delete — the record is hidden, never truly destroyed.

### Common mistakes

> **Warning:** Forgetting to tick the consent checkbox when creating a lead (the form will not submit without it).

> **Warning:** Assuming a missing "Assign" dropdown means a bug — only Operations Managers and Founders can assign leads; everyone else sees a read-only "Assigned to" line.

> **Warning:** Not setting a follow-up date, which means the lead won't appear in anyone's daily follow-up reminders.

### Best practices

> **Tip:** Always log a brief activity note immediately after every call, even a short one — this builds the history the whole team relies on.

> **Tip:** Set a "Next follow-up" date every time you talk to a lead who hasn't decided yet.

> **Tip:** Move the stage promptly and honestly — the Admissions team relies on accurate stages to know who is ready to convert.

### Frequently Asked Questions

**Q: Can I create a lead for someone I met at an event?**
A: Yes — choose **Campaign** or **Walk-in** as the Source when creating the lead.

**Q: Why can't I see leads assigned to another consultant?**
A: Transformation Consultants only see their own assigned leads by design; ask your Operations Manager if you need visibility into another consultant's leads.

**Q: I made a mistake logging an activity. Can I edit or delete it?**
A: No — activity entries cannot be edited or deleted once logged, to keep an honest history. Log a new correcting note instead.

---

## 8. Counselling

### Purpose

Records every counselling conversation held with a lead. A counselling session is the required evidence before someone can be admitted — TerraNext's rule is that nobody is admitted without a documented, recommending counselling session.

### Who should use this module

Transformation Consultants create and update sessions. Operations Managers and Founders can view them.

### What this module does

Tracks upcoming and already-held counselling sessions, and captures the outcome of each one.

### Step 1 — Open Counselling
Click **Counselling** in the Acquisition menu. You'll see two tabs: **Upcoming** and **Held**.


[SCREENSHOT – Counselling]

### Step 2 — Record a new session
Click **Record session**.
Fill in:
- **Lead** (required — pick from the dropdown; already-admitted leads won't appear)
- **Held at** — date and time (required)
- **Mode** — In person, Phone, or Video (required)
- **Notes** — at least 10 characters describing the conversation (required)
- **Needs assessment** (optional)
- **Outcome** — Recommended, Not suitable, or Follow-up needed (required)
- If Outcome is **Recommended**, you must also choose the **Recommended programme** — this is the rule that makes an admission valid later
- **Recommendation remarks** (optional, only shown if Recommended)
Click **Record session**.


[SCREENSHOT – Counselling, Record a new session]

### Step 3 — Review upcoming sessions
The **Upcoming** tab lists sessions that haven't happened yet, soonest first. You cannot edit a session here — there's nothing to correct until it has actually taken place.

### Step 4 — Edit a held session
On the **Held** tab, click the edit icon next to a session to correct its outcome or notes after the fact. Note: setting the outcome to "Recommended" and naming a programme here makes that lead immediately eligible for admission.

### Expected result

Every counselling conversation is on record, and any lead recommended with a named programme becomes ready to move into Admissions.

### Important notes

> **Warning:** Which lead a session belongs to **cannot be changed** once recorded — if you picked the wrong lead, record a new correct session instead.

> **Note:** The specific rule (called "BR-02" inside the system) is: a lead can only be converted into a student if its **most recent** session's outcome is "Recommended" **and** names a programme.

### Common mistakes

> **Warning:** Recording notes shorter than 10 characters — the system will reject this; write at least a short sentence.

> **Warning:** Choosing "Recommended" but forgetting to select a programme — the form will block you until you do.

> **Warning:** Assuming an old "Recommended" session still counts after a newer session with a different outcome was logged for the same lead — only the **most recent** session counts.

### Best practices

> **Tip:** Record the session the same day it happens, while details are fresh.

> **Tip:** Be specific in the Notes field — this is often the only record of what was discussed.

### Frequently Asked Questions

**Q: Can Operations Managers record sessions?**
A: No — only Transformation Consultants can create or edit counselling sessions; Operations Managers can only view them.

**Q: What happens if I mark a session "Not suitable"?**
A: The lead's stage becomes "Counselling attended" but it will **not** be eligible for admission — a later, different session with a "Recommended" outcome would be needed.

---

## 9. Admissions

### Purpose

This is where a ready lead is formally converted into a **Participant** — a permanent student record with its own unique ID. This is one of the most important actions in the whole system, because a Participant ID, once issued, is never reissued or reused.

### Who should use this module

Operations Managers (create/convert), Founders (view). Other roles do not have access to this module.

### What this module does

Shows a queue of leads that are close to being ready for admission, and walks the operator through a careful, step-by-step conversion process.

### Step 1 — Open the Admissions queue
Click **Admissions** in the Acquisition menu. You'll see every lead currently at the "Hot" or "Counselling attended" stage, along with a checklist showing whether each one is ready:
- Counselling session recorded?
- Latest outcome recommends?
- Programme named?


[SCREENSHOT – Admissions]

### Step 2 — Start a conversion
If a lead passes all three checks, a **Convert** button is available. Click it to open the conversion wizard.

### Step 3 — Verify details
Confirm or correct the person's Full name, Date of birth, Phone, Email, Gender, Emergency contact name/phone/relation, and Address. Click **Next**.

### Step 4 — Duplicate check
The system automatically checks whether anyone with the same phone number already has a Participant record.
- If none is found, you'll see a confirmation and can continue.
- If a match is found, you must review the listed record(s) and tick a box confirming this really is a different person before continuing — TerraNext's policy is **one person, one permanent record, ever**.

### Step 5 — Choose programme & batch
Pick the **Programme** (the one recommended during counselling is pre-selected, but you may choose another if appropriate — this is recorded). Optionally pick a **Batch** — batches with no free seats cannot be selected. You may also leave the batch blank and allocate it later.

### Step 6 — Confirm
Review the summary screen and click **Convert to participant**. A confirmation pop-up will remind you this issues a permanent ID. Click **Convert** to finish.

### Expected result

A new Participant record is created with a permanent ID, the lead is marked "Admitted," a fee account is automatically opened for them, and — if they came through a Growth Partner — that partner is notified.

### Important notes

> **Warning:** You cannot reach the conversion screen at all unless the lead genuinely passes the counselling checklist — even trying the direct web address will simply send you back to the queue.

> **Warning:** If the chosen batch happens to fill up in the exact moment you convert, the participant is still created — just left unallocated to a batch, with a warning message — so admission is never blocked by a batch capacity race.

### Common mistakes

> **Warning:** Rushing past the duplicate-check step without genuinely reviewing the listed matches — always click through and check.

> **Warning:** Picking a batch that later turns out to be for the wrong programme — batches shown are always filtered to the chosen programme, so this shouldn't happen, but double-check the batch code before confirming.

### Best practices

> **Tip:** Always double-check personal details at Step 3 — this becomes the permanent Participant record.

> **Tip:** Use the "allocate later" option if you're not yet sure which batch a new student should join, rather than guessing.

### Frequently Asked Questions

**Q: Can I undo an admission?**
A: There is no "undo" button. Contact a System Administrator if a genuine mistake needs correcting.

**Q: What if the recommended programme is wrong?**
A: You can pick a different programme at Step 5 — this is allowed and is simply noted in the audit trail.

**Q: Who can convert a lead?**
A: Only Operations Managers (and Founders, who can do everything).

---

## 10. Parents & Families

### Purpose

Groups related people into a single household ("family") record — useful when counselling a parent about multiple children, or tracking everything a household has done with TerraNext in one place.

### Who should use this module

Operations Managers and Transformation Consultants (create/update), Programme Coordinators (view only).

### What this module does

Maintains family records, the parents/guardians in them, counselling sessions held with parents, and links to every participant and enrolment connected to that household.

### Step 1 — Open Parents & Families
Click **Parents & Families** in the Acquisition menu.


[SCREENSHOT – Parents & Families]

### Step 2 — Search or filter
Use the search box (family name, parent name, or phone), or filter by **Source** or **Conversion status**.

### Step 3 — Create a new family
Click **New family**. Fill in:
- **Family name** (required)
- **Primary contact** name (required)
- **Relation** — Mother, Father, Guardian, or Other (required)
- **Phone** (required)
- **Email**, **Address**, **Notes** (all optional)
- **Source** — Participant's parent, Direct enquiry, Referral, Campaign, or Event
Click **Create**. You're taken straight to the new family's page.


[SCREENSHOT – Parents & Families, Create a new family]

### Step 4 — Explore a family record
Open any family to see four tabs:
- **Parents** — everyone linked to the household, and their conversion status
- **Counselling** — sessions held with any parent in this family
- **Programme history** — every enrolment across every family member
- **Family details** — a read-only summary

### Step 5 — Add a parent
On the Parents tab, click **Add parent** and fill in Name, Phone, Relation (required); Email, Occupation (optional).

### Step 6 — Record a parent counselling session
On the Counselling tab, fill in Parent, Held on, Mode, Notes, Outcome, and (if recommending) Programme, then click **Record session**.

### Step 7 — Convert a parent into a lead
Once a parent has a counselling session recommending a programme, a **Convert to lead** button becomes active next to their name on the Parents tab. Click it to turn that parent into a full Lead, ready to move through the usual pipeline.

### Step 8 — Link an existing participant to this family
On the Programme history tab, click **Link participant**, and type the Participant's ID. This connects (not copies) their record to the household.

### Expected result

A single place to see everything a household has done with TerraNext — every child, every parent, every counselling session, every enrolment.

### Important notes

> **Warning:** A participant can only be linked to **one** family — if they're already linked elsewhere, the system will refuse and tell you so.

> **Note:** A parent can only be converted to a lead after their **own** counselling session recommends a programme — the same rule as for any other lead.

### Common mistakes

> **Warning:** Trying to link a participant who is already part of another family record.

> **Warning:** Attempting to convert a parent to a lead before any counselling session has been recorded for them.

### Best practices

> **Tip:** Create the family record first when you meet a parent with multiple children interested in the academy — it saves duplicate data entry later.

### Frequently Asked Questions

**Q: Can I delete a family record?**
A: There is no delete action for families in the current system.

**Q: Can I see this from the participant's own page?**
A: Not directly today — family information lives in this module, separate from an individual participant's profile.

---

## 11. Colleges

### Purpose

Tracks colleges that refer students to TerraNext, so the organisation can see which colleges are the most valuable sources of leads, and manage named "campus leader" contacts at each one.

### Who should use this module

Operations Managers and Founders (full management), Transformation Consultants (can view, and can manage campus leaders, but cannot add or edit the college record itself — see note below).

### What this module does

Maintains a directory of colleges and, per college, a list of campus leader contacts who help refer students.

### Step 1 — Open Colleges
Click **Colleges** in the Acquisition menu.


[SCREENSHOT – Colleges]

### Step 2 — Search or filter
Use the search box (name, city, contact) or the Status filter (Active / Archived) — these filter instantly as you type, right in your browser.

### Step 3 — Add a college
Click **Add college** (Operations Managers/Founders only). Fill in Name, City (required), Contact person, Contact phone (optional). Click **Add college**.


[SCREENSHOT – Colleges, Add a college]

### Step 4 — Open a college's page
Click any college's name to see how many leads it has referred, how many were admitted, and its conversion rate.

### Step 5 — Manage campus leaders
On a college's page, click **Add leader**. Fill in Name, Phone (required), and optionally a Participant ID if the leader is themselves a past or current student. Use **Deactivate/Reactivate** to toggle a leader's status.

### Step 6 — Archive a college
Rather than deleting, click **Archive** on a college's row to mark it inactive while keeping its full history intact. Click **Restore** to bring it back.

### Expected result

A clear picture of which colleges are worth investing relationship-building time in, based on real conversion numbers.

### Important notes

> **Warning:** Only Operations Managers and Founders can add or edit the core college record itself — Transformation Consultants can manage campus leaders (add/deactivate) but cannot create or rename a college or change its city/contact details. This is a deliberate, narrow exception in the permission system.

> **Warning:** Colleges are **never deleted**, only archived — this preserves historical lead-source reporting.

> **Note:** The system will not allow two colleges with the exact same name.

### Common mistakes

> **Warning:** Trying to edit a college's name/city as a Transformation Consultant — this button will not be visible to that role.

> **Warning:** Creating a duplicate college with slightly different spelling — always search first.

### Best practices

> **Tip:** Keep campus leader phone numbers current — they are often the fastest way to reach a batch of prospective students.

### Frequently Asked Questions

**Q: What's the difference between a college and a campus leader?**
A: A college is the institution itself; a campus leader is a specific person (student or staff) at that college who helps refer enquiries.

**Q: Can an archived college still show in reports?**
A: Yes — archiving hides it from the active list but its historical numbers are preserved.

---

# Part 3 — Academics (Running the Programmes)

## 12. Participants

### Purpose

The Participant profile is the **lifetime record** of every person TerraNext has ever admitted — one record per person, forever, no matter how many times they enrol in different programmes over the years.

### Who should use this module

Operations Managers (full access, including creating new participants), Programme Coordinators (view + academic edits), Trainers (view their own batch's participants), Finance Officers (view finance-relevant fields), Career & Placement Officers (view career-relevant fields).

### What this module does

Stores personal details, every enrolment a person has ever had, uploaded documents, and a running timeline of everything that has happened to their record.

### Step 1 — Open Participants
Click **Participants** in the Academics menu.


[SCREENSHOT – Participants]

### Step 2 — Search
Type a name or phone number in the search box and click **Search**. *(Note: search currently matches from the beginning of a word or number, not the middle — e.g. searching "har" finds "Harish" but searching "ish" will not.)*

### Step 3 — Filter
Narrow the list using **Status**, **Academy**, or **Batch** dropdowns. Click **Clear** to reset.

### Step 4 — Open a participant's profile
Click their name. You'll see five tabs: **Overview**, **Enrolments**, **Documents**, **Comms** (only if you have messaging access), and **Timeline**.

### Step 5 — Edit personal details
On the Overview tab, click **Edit** (if you have permission). Update Full name, Date of birth, Gender, Phone, Email, Address, Emergency contact, and Parent/guardian details, then click **Save changes**.

### Step 6 — Change status
Use the status dropdown at the top of the profile. Choosing **Dropped** requires you to type a reason. All other changes just need confirmation.

### Step 7 — Add a new enrolment (re-enrolment)
On the Enrolments tab, click **Add enrolment**. Fill in Academy, Programme, Batch (all free text for now), and Status, then save. This adds a new enrolment to the **same** lifetime record — it never creates a second participant.


[SCREENSHOT – Participants, Add a new enrolment]

### Step 8 — Allocate or change a batch
Still on the Enrolments tab, click **Allocate batch** / **Change batch** next to an enrolment, and pick from batches with free seats. Full batches are shown but cannot be selected.

### Step 9 — Upload a document
On the Documents tab, choose a document type (Photo, ID proof, Resume, Passport, or Other), pick a file (JPEG, PNG, WebP, or PDF, up to 10MB), and upload. You'll see its status update to "Ready" once the upload is verified.

### Step 10 — Add a note to the Timeline
On the Timeline tab, type a note in the box and click **Add note**. This becomes a permanent part of the record — notes cannot later be edited or deleted.

### Expected result

One clean, permanent, ever-growing history for every person TerraNext has ever taught.

### Important notes

> **Warning:** This profile does NOT currently show Attendance, Assessments, Certificates, Career, or Fees information directly — those live in their own separate modules; you'll need to search for the same participant there. This manual describes what exists today; these tabs may be added to the profile in a future update.

> **Note:** There is no "History"/audit tab separate from Timeline — Timeline is the complete story.

> **Warning:** There is currently no way to add or view "tags" on a participant, even though this is planned.

> **Warning:** Creating a participant with a phone number that already exists on file does **not** block the action — you'll get a warning instead, so you can check for a possible duplicate afterward.

### Common mistakes

> **Warning:** Searching for a participant using the middle of their name instead of the start.

> **Warning:** Uploading a document over 10MB or in an unsupported file type — the system will reject it with a clear message.

> **Warning:** Expecting to see fee balances or attendance percentages on this page — check the Fees and Attendance modules directly instead.

### Best practices

> **Tip:** Always add a Timeline note after any meaningful conversation with a participant or their family — this is the shared institutional memory for that person.

> **Tip:** Use "Add enrolment" (not a new participant record) whenever an existing student returns for another programme.

### Frequently Asked Questions

**Q: How do I know a participant's current status?**
A: Look at the status badge at the top of their profile: Enrolled, Active, Completed, Dropped, or Alumni.

**Q: Can I manually mark someone "Alumni"?**
A: No — Alumni status is earned automatically only through certification (see Chapter 17 — Certificates), and cannot be manually assigned from this screen.

**Q: Why is the Academy/Programme field on "Add enrolment" a text box instead of a dropdown?**
A: This is a known current limitation — these fields are free text for now rather than linked to the Programmes catalogue.

---

## 13. Programmes & Academies

### Purpose

The catalogue of everything TerraNext teaches — grouped into **Academies** (broad subject groupings) and, within each, individual **Programmes** (specific courses), along with each programme's certificate rules and default pricing.

### Who should use this module

Operations Managers and Programme Coordinators (create/edit). Everyone else can view.

### What this module does

Defines what programmes exist, what it takes to earn a certificate in each one, and what the standard fee is.

### Step 1 — Open Programmes
Click **Programmes** in the Academics menu. You'll see two tabs: **Programmes** and **Academies**.


[SCREENSHOT – Programmes & Academies]

### Step 2 — Create an Academy first
On the Academies tab, click **New academy** (disabled if you lack permission). Fill in Name (a web-friendly "slug" is suggested automatically) and an optional Description. Click **Create academy**. *(A programme cannot exist without an academy to belong to.)*


[SCREENSHOT – Programmes & Academies, Create an Academy first]

### Step 3 — Create a Programme
On the Programmes tab, click **New programme**. Fill in:
- **Academy** (required — pick from your active academies)
- **Code** (required, uppercase letters/numbers/hyphens only, e.g. `GENZ-CF-26`)
- **Name**, **Duration (days)**, **Sessions** (all required)
- **Eligibility** and **Curriculum summary** (optional)
- **Certificate rules**: **Minimum attendance %** and **Minimum assessment score** (both required — these decide who qualifies for a certificate later, see Chapter 17)
- **Default fee plan**: **Total fee**, plus optional **Installments** (each with a Label, Amount, and Due date) — if you add installments, they must add up exactly to the total fee
Click **Create programme**.

### Step 4 — Edit or archive
Use the **Edit** and **Archive/Restore** buttons on any row. Archiving is reversible and keeps full history — nothing is ever deleted.

### Expected result

A single, trustworthy source of truth for every programme TerraNext offers, its pricing, and its certificate requirements — used automatically by Admissions, Fees, and Certificates.

### Important notes

> **Warning:** Programme codes and academy slugs must be unique and follow a strict format (uppercase for codes, lowercase for slugs).

> **Warning:** Installments **must** sum exactly to the total fee, or the form will not let you save.

### Common mistakes

> **Warning:** Trying to create a programme before its academy exists.

> **Warning:** Installment amounts that don't add up to the total fee — the system shows exactly how much is missing or over.

### Best practices

> **Tip:** Set certificate thresholds thoughtfully — they directly control who becomes eligible for a certificate later, with no manual override except by an Operations Manager under exceptional, documented circumstances.

### Frequently Asked Questions

**Q: Can I delete a programme that's no longer offered?**
A: No — archive it instead. This keeps all historical enrolments intact.

**Q: Who sets the certificate pass thresholds?**
A: Operations Managers and Programme Coordinators, when creating or editing a programme.

---

## 14. Batches

### Purpose

A **Batch** is a specific running instance of a programme — a group of students, a schedule, a trainer, and a start/end date.

### Who should use this module

Operations Managers and Programme Coordinators (create/manage); Trainers (view their own); everyone else (view).

### What this module does

Manages batch schedules, rosters, and session calendars.

### Step 1 — Open Batches
Click **Batches** in the Academics menu.


[SCREENSHOT – Batches]

### Step 2 — Create a batch
Click **New batch**. Fill in:
- **Programme** (required)
- **Batch code** (required, e.g. `GENZ-B1-26`)
- **Start date** and **End date** (required)
- **Capacity** (required — maximum seats)
- **Trainer** (optional — can be assigned later)
- **Days** — tick which weekdays this batch meets (at least one required)
- **Start time** and **End time** (required)
Click **Create batch**. The full session calendar is generated automatically from your weekly schedule.


[SCREENSHOT – Batches, Create a batch]

### Step 3 — Open the Batch Workspace
Click a batch to see three tabs: **Roster**, **Sessions**, **Details**.

### Step 4 — Review the Roster
Shows every participant currently allocated to this batch. *(Note: you allocate participants to a batch from the individual participant's own profile — Chapter 12, Step 8 — not from this screen.)*

### Step 5 — Manage Sessions
See every scheduled session with its date, topic, and status. If the calendar looks incomplete (e.g. after editing the schedule), click **Generate missing** to fill in any gaps. Update a session's status to Scheduled, Held, or Cancelled as needed.

### Step 6 — Check Details
Read-only summary of the programme, trainer, date range, and weekly schedule.

### Step 7 — Change batch status
Use the status dropdown at the top: Planned, Running, Completed, or Cancelled.

### Expected result

A clear, capacity-aware roster and session calendar for every group of students in training.

### Important notes

> **Note:** Attendance is not marked from this screen — that happens in the separate Attendance module (Chapter 15). Likewise, **assessments are entered in the separate Assessments module** (Chapter 16), not here.

> **Note:** Capacity is strictly enforced the moment a seat is actually taken — if two staff try to allocate the last seat at the same instant, only one will succeed and the other will be asked to try again. This protects against overbooking.

> **Warning:** Capacity cannot be reduced below the number of participants already allocated.

### Common mistakes

> **Warning:** Looking for an "allocate participant" button inside the batch workspace — it isn't here; go to the participant's own Enrolments tab instead.

> **Warning:** Forgetting to tick at least one weekday when creating a batch.

### Best practices

> **Tip:** Assign a trainer as early as possible, even if seats aren't yet full — this keeps planning visible to everyone.

> **Tip:** Use "Generate missing" after any schedule correction to keep the session calendar complete.

### Frequently Asked Questions

**Q: Can a Trainer create a batch?**
A: No — only Operations Managers and Programme Coordinators can create or edit batches. Trainers can view their own assigned batches.

**Q: What happens to sessions if I change the weekly schedule after creating the batch?**
A: Use "Generate missing" on the Sessions tab to add any newly-implied sessions; existing sessions are not automatically deleted.

---

## 15. Attendance

### Purpose

Records who was present, absent, late, or excused for every training session.

### Who should use this module

Trainers (mark attendance for their own batches only), Programme Coordinators and Operations Managers (mark for any batch), Founders (view).

### What this module does

A simple, fast, tap-to-mark attendance grid, designed to be usable on a phone in under two minutes for a typical class.

### Step 1 — Open Attendance
Click **Attendance** in the Academics menu. You'll see every batch that is currently Planned or Running. *(Trainers only see their own assigned batches here.)*


[SCREENSHOT – Attendance]

### Step 2 — Open a batch's sessions
Click a batch to see every session, with a "Marked" count showing how many of the roster have been recorded.

### Step 3 — Mark a session
Click **Mark** (or **Review**, if already fully marked) next to a session.


[SCREENSHOT – Attendance, Mark a session]

### Step 4 — Tap each participant's status
For each person on the roster, tap one of four large buttons: **P**resent, **A**bsent, **L**ate, or **E**xcused. Use **Mark all present** to quickly set everyone present, then adjust the exceptions.

### Step 5 — Save
Click **Save attendance**. Nothing is recorded until you click this — your taps are held temporarily so a slow internet connection never interrupts your marking.

### Expected result

An accurate attendance record for every session, which automatically feeds each participant's attendance percentage — used later for certificate eligibility.

### How the attendance percentage is calculated

- **Present** and **Late** both count as "attended."
- **Excused** sessions are removed from the calculation entirely — they neither help nor hurt the percentage.
- **Absent** counts against the percentage.
- The percentage is always freshly recalculated from the raw records, so it is always accurate even if past entries are corrected.

### Important notes

> **Warning:** A Trainer can only mark attendance for batches they are personally assigned to teach — attempting another batch is blocked.

> **Warning:** There is no dedicated "at-risk students" screen inside Attendance itself. For a list of participants falling below their required attendance threshold, use the **"Attendance risk"** report in the Reports module (Chapter 29).

### Common mistakes

> **Warning:** Forgetting to click **Save attendance** after tapping statuses — nothing is recorded until you save.

> **Warning:** Confusing "Excused" with "Absent" — Excused does not count against the student, Absent does.

### Best practices

> **Tip:** Mark attendance the same day, ideally right at the end of the session, while it's fresh in your mind.

> **Tip:** Use "Mark all present" as a starting point for large classes, then correct the exceptions — it's faster than tapping every single person.

### Frequently Asked Questions

**Q: Can I mark attendance for a session that hasn't happened yet?**
A: The screen will let you open any session, but you should only mark ones that have actually occurred.

**Q: Where do I see who is at risk of missing the certificate attendance requirement?**
A: Reports → Attendance risk (Chapter 29).

---

## 16. Assessments

### Purpose

Records test/assessment scores for a batch, and automatically works out who passed or failed based on each assessment's pass mark.

### Who should use this module

Programme Coordinators (any batch), Trainers (their own assigned batches only).

### What this module does

Creates assessment events tied to a batch, and provides a simple grid for entering everyone's score.

### Step 1 — Open Assessments
Click **Assessments** in the Academics menu.


[SCREENSHOT – Assessments]

### Step 2 — Create a new assessment
Click **New assessment**. Fill in:
- **Batch** (required — choose from currently planned/running batches; Trainers only see their own)
- **Name** (required, e.g. "Module 1 test")
- **Max score** (required)
- **Pass score** (required — cannot be higher than the max score)
- **Held on** date (required)
Click **Create**.


[SCREENSHOT – Assessments, Create a new assessment]

### Step 3 — Enter scores
Open the assessment and type each participant's score into their row. As you type, a live **Pass**/**Fail** preview badge appears next to the box.

### Step 4 — Save
Click **Save scores**.

### Expected result

Every participant's result for that assessment is recorded, contributing to their overall assessment average — used later for certificate eligibility.

### Important notes

> **Note:** Leaving a score box empty removes any previously entered score — it is treated as "not yet scored," not as a zero. Be careful not to accidentally clear a score by leaving the box blank.

> **Warning:** Scores must be whole numbers between 0 and the assessment's maximum score.

> **Warning:** The pass/fail shown while typing is only a preview — the official result is always recalculated by the system when you save, from the assessment's actual pass mark.

> **Note:** Trainers can only enter scores for batches they teach.

### Common mistakes

> **Warning:** Accidentally clearing a score by leaving the input blank when you meant to leave it unchanged.

> **Warning:** Entering a score higher than the maximum — the system will reject it.

### Best practices

> **Tip:** Enter scores as soon as marking is complete, so certificate eligibility (Chapter 17) reflects reality quickly.

### Frequently Asked Questions

**Q: Can I change the pass mark after scores are already entered?**
A: Yes — every result is automatically re-derived from the new pass mark, and this change is recorded in the audit trail.

**Q: What happens if a student misses the assessment entirely?**
A: Leave their score blank — they will show as not yet scored, which counts against certificate eligibility until they are assessed.

---

## 17. Certificates

### Purpose

Manages who has earned a certificate, checks eligibility automatically against each programme's rules, and maintains the official issued-certificate registry.

### Who should use this module

Programme Coordinators (check eligibility), Operations Managers (issue, override, and revoke), Trainers (view only), Founders (view).

### What this module does

Continuously and automatically works out who currently qualifies for a certificate, based on live attendance and assessment data — never from a stale, cached number.

### Step 1 — Open Certificates
Click **Certificates** in the Academics menu. You'll see two tabs: **Eligibility queue** and **Registry**.


[SCREENSHOT – Certificates]

### Step 2 — Review the eligibility queue
Every participant currently in-progress or completed on a programme is listed, with their live Attendance % and Assessment score compared against the programme's requirements, and a clear **Eligible** / **Not eligible** badge.
- If **Not eligible**, the exact reasons are listed underneath (e.g. "Attendance is 62%, below the required 75%.")

### Step 3 — Issue a certificate
If eligible, click **Issue**. It is issued immediately — there's no extra confirmation step needed because the rules were already met.


[SCREENSHOT – Certificates, Issue a certificate]

### Step 4 — Issue despite not meeting the rules (Override — Operations Managers only)
If not eligible but there is a good reason to issue anyway, click **Override**. You must type a reason of at least 10 characters explaining why. This is a permanent, audited exception — use it sparingly.

### Step 5 — View the Registry
The **Registry** tab lists every certificate ever issued, with the exact attendance and score numbers frozen at the moment it was issued (so later changes to attendance data never rewrite certificate history), its status, and — if revoked — the reason why.

### Step 6 — Revoke a certificate (Operations Managers only)
Click **Revoke** next to an issued certificate. You must type a reason of at least 10 characters. The certificate record is kept forever — revoking never deletes it, it just marks it as no longer valid.

### Expected result

A trustworthy, tamper-evident record of who has genuinely earned each certificate, and why any exceptions were made.

### Important notes

> **Warning:** Issuing a certificate automatically grants the person permanent **Alumni** status (Chapter 21) — this is the only way alumni status is ever granted, other than a rare manual override by a System Administrator.

> **Warning:** A revoked certificate cannot be revoked a second time.

> **Note:** This module currently has no visible public "verify a certificate" web page — although the system does have a background capability an employer's system could use to check a certificate number is genuine, there is no user-facing screen for this in the current build.

### Common mistakes

> **Warning:** Writing an override or revoke reason under 10 characters — the system requires enough detail to make the exception meaningful.

> **Warning:** Assuming certificate eligibility updates only when you visit the page — it's true live; the queue reflects reality the instant attendance or scores change.

### Best practices

> **Tip:** Reserve overrides for genuinely exceptional cases, and write a clear, specific reason every time — this becomes a permanent audit record.

### Frequently Asked Questions

**Q: Who can issue certificates?**
A: Programme Coordinators can see and act on eligibility; overrides and revocations are Operations Manager actions.

**Q: Does revoking a certificate remove someone's Alumni status?**
A: No — revocation only affects the certificate record itself, not alumni membership.

---

# Part 4 — Career & Alumni

## 18. Career Interest

### Purpose

Captures what kind of job or country a participant is interested in, and records a human decision about whether they are ready to enter the placement pipeline.

### Who should use this module

Career & Placement Officers (create/update/evaluate). Operations Managers, Founders, and Transformation Consultants can view.

### What this module does

Keeps one career-interest profile per participant, a running timeline of guidance sessions, and an eligibility decision panel.

### Step 1 — Open Career Interest
Click **Career Interest** in the Career menu.


[SCREENSHOT – Career Interest]

### Step 2 — Add a career profile
Click **Add career profile**, type the person's **Participant ID**, and click **Continue** — you'll land on their new, blank profile.


[SCREENSHOT – Career Interest, Add a career profile]

### Step 3 — Fill in interest details
On the profile page, fill in:
- **Preferred job categories** (comma-separated, e.g. "Hospitality, Nursing")
- **Preferred countries** (comma-separated, e.g. "UAE, Germany")
- **Passport status** — None, Applied, or Held
- **Resume status** — None, Draft, Reviewed, or Final
- **Willing to relocate** (checkbox)
Click **Save**.

### Step 4 — Log a guidance session
Fill in **Held on** (date, required), **Notes** (required, at least a sentence), and optionally a **Counsellor recommendation**. Click **Record session**. This builds a running timeline on the profile.

### Step 5 — Decide eligibility
In the "Placement eligibility" panel, choose **Eligible** or **Not eligible**, optionally enter a **Readiness score** (0–100), and write a **Recommendation/note** of at least 10 characters explaining the decision. Click **Record decision**.

### Expected result

A clear, honest, human judgement call on record for every participant considered for placement — never an automatic calculation.

### Important notes

> **Warning:** Eligibility is always a deliberate human decision — the system never calculates it automatically from readiness score, passport, or resume status. A Career & Placement Officer must actively make this call, and can change it again at any time.

> **Note:** There is no separate "checklist" pop-up for evaluating eligibility — the Decision, Readiness score, and Note fields described above are the entire evaluation screen.

### Common mistakes

> **Warning:** Writing a recommendation note under 10 characters — the system will block saving until it's long enough.

> **Warning:** Assuming a high readiness score automatically makes someone "Eligible" — it does not; a human must still choose the decision explicitly.

### Best practices

> **Tip:** Always explain your eligibility decision clearly in the note — it is the only record of the reasoning behind who enters the placement pipeline.

### Frequently Asked Questions

**Q: Can I re-evaluate someone's eligibility later?**
A: Yes, at any time, by any Career & Placement Officer.

**Q: Who can see career profiles?**
A: Career & Placement Officers manage them; Operations Managers, Founders, and Transformation Consultants can view.

---

## 19. Placements

### Purpose

Manages the selective pipeline of eligible participants being placed with employers — and enforces TerraNext's promise that a student is **never** charged a placement fee.

### Who should use this module

Career & Placement Officers (create/manage). Operations Managers and Founders can view.

### What this module does

A visual pipeline board showing every placement's current stage.

### Step 1 — Open Placements
Click **Placements** in the Career menu. You'll see columns: **Under review**, **Shortlisted**, **Interview**, **Offer**, **Placed**, and **Dropped**.


[SCREENSHOT – Placements]

### Step 2 — Create a new placement
Click **New placement**. Fill in:
- **Participant ID** (required — must belong to someone already marked "Eligible" in Career Interest, or the system will reject it)
- **Employer** (required — pick from active employers)
- **Job category** and **Country** (both required)
- **Third-party cost disclosure** (optional — e.g. visa/travel costs the candidate may bear, separate from any TerraNext fee)
Click **Create placement**.


[SCREENSHOT – Placements, Create a new placement]

### Step 3 — Move a placement forward
On any placement card, use **Move to…** to advance it through the pipeline (you can only move forward, never skip backward). Add an optional note explaining the move.

### Step 4 — Mark as dropped
Choose **Dropped** from the same dropdown at any stage (except once already Placed). You must type a reason of at least 5 characters.

### Expected result

A live, visual view of every candidate's placement progress, always showing "Fee to student: ₹0" on every card as a constant reminder of TerraNext's no-fee promise.

### Important notes

> **Warning:** Only career-eligible participants can enter this pipeline — if you try to create a placement for someone not yet marked eligible, it will be rejected with an explanation. Check their Career Interest status first.

> **Warning:** TerraNext never charges the student a placement fee — this is enforced by the system itself, not just policy; the fee field is permanently fixed at ₹0.

> **Note:** There is currently no individual detail page per placement — everything is managed from the board and its cards.

### Common mistakes

> **Warning:** Trying to create a placement before evaluating career eligibility — do Chapter 18 first.

> **Warning:** Trying to move a placement backward in the pipeline — not permitted; use "Dropped" instead if it needs to exit the pipeline.

### Best practices

> **Tip:** Always disclose any third-party costs (like visa fees) clearly at creation time, even though TerraNext's own fee is always zero.

### Frequently Asked Questions

**Q: Can a placement skip straight from "Under review" to "Placed"?**
A: No — it must move through each stage in order (Dropped is the only exception, reachable from any active stage).

**Q: Where can I export placement data?**
A: There is no export button inside this module today; a summary funnel view is available in Reports (Chapter 29).

---

## 20. Employers

### Purpose

Maintains the directory of employers who receive placement candidates.

### Who should use this module

Career & Placement Officers (create/manage). Everyone else can view.

### What this module does

A simple directory of employer organisations, their country/industry, and contact details.

### Step 1 — Open Employers
Click **Employers** in the Career menu.


[SCREENSHOT – Employers]

### Step 2 — Add an employer
Click **New employer**. Fill in Name and Country (required); Industry, Contact name/phone/email, and an Agreement note (all optional). Click **Create employer**.


[SCREENSHOT – Employers, Add an employer]

### Step 3 — Edit an employer
Click **Edit** on any row to update their details.

### Step 4 — Archive an employer
Click **Archive**. If they already have placements on record, you'll be asked to confirm — archiving never deletes their placement history.

### Expected result

A trustworthy, up-to-date list of employer partners available to select when creating a placement.

### Important notes

> **Note:** The employer directory shows only a **count** of placements per employer, not a detailed drill-down list — to see individual placements for an employer, check the Placements board (Chapter 19).

> **Warning:** Employer names must be unique.

### Common mistakes

> **Warning:** Creating a near-duplicate employer with a slightly different name — always check the existing list first.

### Best practices

> **Tip:** Keep contact details current, especially the primary contact's phone/email, since this is often used to coordinate interviews.

### Frequently Asked Questions

**Q: Can I see all placements for one employer in one place?**
A: Not as a dedicated list today — only the total count is shown on the directory.

---

## 21. Alumni

### Purpose

Tracks everyone who has graduated with a certificate, and their ongoing relationship with TerraNext (referrals, event attendance, and consent to share their story).

### Who should use this module

Operations Managers and Founders (record engagement, manage consent). System Administrators (manual override only). Everyone else can view.

### What this module does

An automatically-populated registry — alumni status is granted the moment someone earns a certificate (Chapter 17) — plus simple tools to log ongoing engagement.

### Step 1 — Open Alumni
Click **Alumni** in the Career menu. You'll see everyone who has earned Alumni status, when, and their referral/event counts.


[SCREENSHOT – Alumni]

### Step 2 — Record engagement
Click **+1 referral** or **+1 event** on any row each time that alumnus refers someone new or attends an event. Each click adds exactly one — there's no way to enter a specific bigger number, and no way to reduce a count.


[SCREENSHOT – Alumni, Record engagement]

### Step 3 — Manage success-story consent
Click **Record consent** to mark that an alumnus has agreed their story can be shared publicly, or **Withdraw consent** to reverse this. Every change is permanently logged with who did it and when.

### Step 4 — Manual override (System Administrators only)
If someone should be granted Alumni status outside the normal certificate route (a rare exception), click **Manual override**, enter their Participant ID and a reason of at least 10 characters, then click **Grant alumni status**.

### Expected result

An accurate, growing record of TerraNext's graduate community and how engaged they remain.

### Important notes

> **Warning:** Alumni status is **granted automatically** the moment a certificate is issued — there is no manual "add alumnus" button for the normal path; only the rare override path above is manual, and it is restricted to System Administrators.

> **Warning:** Consent changes are always recorded in the audit trail with the before/after value.

### Common mistakes

> **Warning:** Looking for a way to log a specific number of referrals at once — the system only supports adding one at a time, repeatedly.

> **Warning:** Attempting a manual override without System Administrator access — the button will simply be blocked.

### Best practices

> **Tip:** Ask alumni for success-story consent explicitly and record it accurately — never assume consent.

### Frequently Asked Questions

**Q: Does completing a programme automatically make someone Alumni?**
A: No — specifically **earning a certificate** does. Completion alone is not the trigger.

**Q: Can I reduce a referral count if I clicked by mistake?**
A: No — there is currently no decrease button. Contact a System Administrator if a correction is genuinely needed.

---

## 22. NextStep

### Purpose

NextStep is TerraNext's name for an ongoing mentorship relationship with graduates after certification — separate from Career Interest and Placements (Chapters 18–19), which are about entering a job. This chapter exists to explain, honestly, exactly how much of that concept is built into the CRM today.

### Who should use this module

**Nobody, today** — there is no screen for any role to use. This chapter is included so that if you have heard the term "NextStep" used in planning conversations, you understand precisely what does and does not exist for it right now, rather than searching the CRM for a button that isn't there.

### What this module does today

**Currently not available.** The only trace of NextStep inside the CRM is a single hidden yes/no flag stored on each Alumni record (Chapter 21), recording whether that person has been enrolled in NextStep. There is:

- No screen anywhere to view, set, or clear this flag
- No workflow, stage, fee, or exit process
- No connection to Attendance, Assessments, or any other module

The underlying capability to change this flag exists in the system's backend code, but it is not connected to any button, screen, or menu item — so in practice, no one can act on it today.

[SCREENSHOT – Alumni Page, showing no NextStep control present]

### Important notes

> **Warning:** If a founder, manager, or partner mentions "NextStep enrolment," be aware there is currently no way to actually record or view this in the CRM. Track it outside the system (e.g. a spreadsheet) until this module is built.

> **Note:** "NextStep" is also the name of one of the options in the Academy dropdown on the public website's Apply form (Chapter 42) — that is a **different, unrelated use of the same name**: it simply lets a website visitor indicate interest in a NextStep-branded offering as a lead, which becomes an ordinary Lead record (Chapter 7) like any other enquiry. It has no connection to the Alumni NextStep flag described in this chapter.

### Common mistakes

> **Warning:** Confusing the "NextStep" academy option on the public Apply form with true NextStep mentorship tracking — the two are unrelated today.

> **Warning:** Searching the Alumni or Participant screens for a "NextStep" toggle — it does not exist on any screen.

### Frequently Asked Questions

**Q: Will NextStep tracking be added later?**
A: This manual describes the system as it exists today; check with your System Administrator or Founder for the current development roadmap.

**Q: Where should I track NextStep mentorship relationships in the meantime?**
A: Outside the CRM, using whatever method your organisation currently prefers — the Timeline note field on a participant's own profile (Chapter 12) is one option for keeping at least a simple record visible to staff, even though it is not a dedicated NextStep feature.

---

# Part 5 — Growth Partner Management

## 23. Growth Partners

### Purpose

Manages individual external referral partners — people outside TerraNext who refer prospective students and earn rewards for successful referrals.

### Who should use this module

Founders and System Administrators (approve, reject, suspend, reactivate). Operations Managers (register new partners, view). Finance Officers (view only).

### What this module does

Tracks partner applications from submission through approval, and displays their referral and reward activity.

### Step 1 — Open Growth Partners
Click **Partners** under the Growth Partners menu group.


[SCREENSHOT – Growth Partners]

### Step 2 — Register a partner directly (staff-entered)
Click **Register partner**. Fill in Name, Email, Phone (required); Organisation (optional). Click submit. The partner is created as **"Pending approval"** — they cannot sign in yet.

*(Note: most partners actually arrive by registering themselves on the public website — see Chapter 44 — and appear here automatically, already pending approval.)*


[SCREENSHOT – Growth Partners, Register a partner directly]

### Step 3 — Review and approve or reject
Open a pending partner's profile. Click **Approve** to activate their account (this automatically creates their login and emails them a "set your password" link), or **Reject** to decline (a confirmation pop-up warns this can only be reversed by registering them again).

### Step 4 — Suspend or reactivate an active partner
On an active partner's profile, click **Suspend partner** to immediately block their portal access (they are signed out right away), or **Reactivate partner** to restore it.

### Step 5 — Get their QR code
Once approved, open the partner's profile and find the **QR code** card. You can **Download PNG** or **Download SVG** — the same QR code the partner can also download themselves from their own Partner Portal (Chapter 41). Anyone scanning it is sent to the public application form with the referral automatically credited to this partner.

### Step 6 — Review their rewards
If you have rewards access, scroll to the **Reward ledger** card to see their wallet balance and every reward they've earned.

### Step 7 — Get or re-send their portal access
Once a partner is **Active**, their profile shows a **"Portal account: Active"** badge alongside a **Resend Access Email** button. Click it to send them a fresh secure "set your password" link — useful if their original welcome email never arrived, expired unused, or they've simply lost it. This never creates a second account and never emails a plain-text password; it's always a fresh, single-use, time-limited link, exactly like the original approval email. This button is limited to a few uses per partner per hour, to prevent accidental spamming.

### Step 8 — Check the Leaderboard
Back on the main Partners list, scroll down to see the Leaderboard — a ranking of partners by total rewards earned.

### Expected result

A controlled approval gate ensures nobody gains partner portal access without staff sign-off, and clear visibility into who is earning the most through referrals.

### Partner status values, explained

| Status | Meaning |
|---|---|
| Pending approval | Applied, not yet decided |
| Active | Approved, can sign in and refer leads |
| Suspended | Temporarily blocked from signing in |
| Rejected | Application declined |

### Important notes

> **Warning:** Only Founders and System Administrators can approve, reject, suspend, or reactivate a partner. Operations Managers can register new partners and view, but cannot decide their status.

> **Warning:** Rejecting shows no text box to type a reason — this action currently has no way to record why in this screen.

> **Note:** Leadership level (Bronze/Silver/Gold/Platinum) is **not** a fixed Bronze/Silver/Gold/Platinum scale — it is a set of named tiers your own organisation defines in **Settings → Leadership Levels** (Chapter 34), each with its own name, description, display order, and badge colour. A new partner is automatically placed on whichever active tier is set as lowest in display order. A System Administrator or Founder can change a partner's tier at any time from the **Leadership level** dropdown on this same profile page — see Step 9 below.

> **Note:** This screen does **not** show a list of the leads that partner has referred — that information exists elsewhere in the system but is not surfaced here today.

> **Note:** The **Resend Access Email** button only appears once a partner is Active **and** already has a portal account (i.e., after they've been approved at least once) — it is not the same action as Approve, and it never creates a duplicate account.

### Step 9 — Change a partner's leadership level

Use the **Leadership level** dropdown on the partner's profile (visible if you have permission to update partners) and pick a different tier. This takes effect immediately and is recorded in the audit trail.

[SCREENSHOT – Growth Partner Detail Page, Leadership Level Dropdown]

### Common mistakes

> **Warning:** Approving a partner without double-checking their details are genuine — this immediately grants portal access.

> **Warning:** Expecting a "referred leads" list on this page — it isn't there currently.

> **Warning:** Assuming leadership levels are a fixed, universal Bronze/Silver/Gold/Platinum scale — they are entirely defined by your own organisation in Settings and can be renamed, reordered, or added to at any time.

### Best practices

> **Tip:** Review pending applications promptly — an approved partner cannot start referring (and the business cannot benefit) until you act.

### Frequently Asked Questions

**Q: What happens to a rejected applicant if they reapply?**
A: They must submit a brand-new registration; rejection cannot simply be reversed on the existing record.

**Q: Can Finance approve a partner?**
A: No — Finance can only view Growth Partner records.

---

## 24. Growth Community Business

### Purpose

Manages business-type referral partners (gyms, salons, cafés, tuition centres, and similar local businesses) who refer people to TerraNext and, once approved, get their own QR code for easy referrals.

### Who should use this module

Founders and System Administrators (approve/reject/suspend/reactivate). Operations Managers (register, view). Finance Officers (view).

### What this module does

Works almost identically to Growth Partners (Chapter 23), but for business entities — including the same QR code and portal-access features.

### Step 1 — Open Growth Community Business
Click **Growth Community Business** under the Growth Partners menu group.


[SCREENSHOT – Growth Community Business]

### Step 2 — Register a business
Click **Register business**. Fill in Organisation name, Business category (a dropdown — e.g. Gym, Café, Hospital, NGO), Contact person, Email, Phone (all required). Submit — it is created "Pending approval."

*(Most businesses actually register themselves on the public website — Chapter 45.)*


[SCREENSHOT – Growth Community Business, Register a business]

### Step 3 — Approve, reject, suspend, or reactivate
Same process as Chapter 23. On approval, the business is automatically given a permanent **Partner ID** (formatted like `TCGN-000001`).

### Step 4 — Get their QR code
Once approved, open the business's profile and find the **QR code** card. You can **Download PNG** or **Download SVG** — this is the code the business can print and display; anyone scanning it is sent to the public application form with the referral automatically credited.

### Step 5 — Get or re-send their portal access
Just like Growth Partners (Chapter 23, Step 7), an Active business's profile shows a **"Portal account: Active"** badge and a **Resend Access Email** button — use it to send a fresh secure "set your password" link if the original one was lost or never arrived. This never creates a duplicate account and is limited to a few uses per business per hour.

### Expected result

An approved network of local businesses, each with their own scannable QR referral code, feeding qualified leads into TerraNext.

### Important notes

> **Note:** This is a **completely separate list of partners from Growth Partners (Chapter 23)** — they are managed independently, even though both use the same approval process and both earn rewards through the same wallet system.

> **Note:** A Partner ID and QR code only exist **after** approval — a pending business has neither yet.

### Common mistakes

> **Warning:** Looking for the QR code before approval — it will not exist yet.

> **Warning:** Confusing this module with Growth Partners — they are separate lists, even though the screens look similar.

### Best practices

> **Tip:** Encourage newly-approved businesses to print and display their QR code prominently — it is their easiest referral tool.

### Frequently Asked Questions

**Q: What's the difference between a Growth Partner and a Growth Community Business?**
A: A Growth Partner is an individual; a Growth Community Business is an organisation/business. They're tracked separately but rewarded the same way.

**Q: Can I see how many times a business's QR code has been scanned?**
A: This is tracked internally by the system but is not currently displayed on any screen.

---

## 25. Reward Rules

### Purpose

Defines exactly how much a partner earns for a successful referral, per programme.

### Who should use this module

Founders and System Administrators (create/edit rules). Finance Officers (view only).

### What this module does

A configurable list of reward rules — either a flat rupee amount or a percentage of the payment — applied automatically whenever a payment is recorded for a referred participant.

### Step 1 — Open Reward Rules
Click **Reward Rules** under the Growth Partners menu group.


[SCREENSHOT – Reward Rules]

### Step 2 — Create a rule
Click **New reward rule**. Choose:
- **Programme** — a specific programme, or "All programmes" for a universal rule
- **Reward type** — Flat amount (₹) or Percentage of payment
- **Amount** — either the rupee amount, or the percentage
Click **Create**.


[SCREENSHOT – Reward Rules, Create a rule]

### Step 3 — Activate or deactivate
Click the toggle button on any rule to switch it Active/Inactive. Creating or activating a new rule for the same programme automatically deactivates any older rule for that same programme — there is only ever one active rule per programme at a time.

### Expected result

Rewards are calculated and paid to partners' wallets completely automatically, with no manual "award a reward" step, every time a qualifying payment is recorded.

### Important notes

> **Warning:** New rules only apply to payments recorded after the rule is created — never retroactively.

> **Note:** Rewards are generated entirely automatically by the system the moment a payment is recorded for a participant who has a referring partner — there is no manual button anywhere to "give" a reward.

> **Note:** If a payment is later reversed, any reward it generated is automatically clawed back from the partner's wallet.

### Common mistakes

> **Warning:** Assuming a new rule affects past payments — it never does.

> **Warning:** Creating two active rules for the same programme by mistake — the system automatically resolves this by deactivating the older one, so double-check which rule is actually active before relying on it.

### Best practices

> **Tip:** Review reward rules periodically to ensure they still reflect current business incentives.

### Frequently Asked Questions

**Q: How is a reward calculated for a percentage rule?**
A: As a percentage of the actual payment amount recorded, rounded to the nearest paisa.

**Q: Who decides which rule applies if there's both a programme-specific and a universal rule?**
A: The programme-specific rule always wins over the universal ("All programmes") rule.

---

## 26. Payouts

### Purpose

Manages partners' requests to be paid out their earned reward balance.

### Who should use this module

Founders and Finance Officers (approve/reject/mark paid). Operations Managers and System Administrators (view only).

### What this module does

A queue of payout requests submitted by partners from their own portal (Chapter 38), waiting for a staff decision.

### Step 1 — Open Payouts
Click **Payouts** under the Growth Partners menu group.


[SCREENSHOT – Payouts]

### Step 2 — Review a request
Each row shows the partner, the requested amount, and its status.

### Step 3 — Approve or reject
Click **Approve** or **Reject** on a "Requested" row.


[SCREENSHOT – Payouts, Approve or reject]

### Step 4 — Mark as paid
Once approved and the money has actually been transferred to the partner outside the system (e.g. via bank transfer), come back and click **Mark paid**. This deducts the amount from their wallet and closes out the matching reward entries.

### Expected result

A clean, auditable record of every payout decision and completion, with wallet balances always accurate.

### Important notes

> **Warning:** A partner always requests their entire available balance — there is no way for them to request a partial amount, and no way for staff to enter a different amount.

> **Note:** There is no bank reference number or payment method field anywhere in this screen — "Mark paid" only records that payment has happened, not how. Keep your own external record of the actual bank transfer/UPI reference if needed for reconciliation.

> **Note:** Marking as paid is a manual, deliberate step — the system does not automatically detect that money has left TerraNext's account.

### Common mistakes

> **Warning:** Clicking "Mark paid" before the money has genuinely been transferred outside the system.

> **Warning:** Expecting to change the requested amount — this is not possible; the request is always for the full balance.

### Best practices

> **Tip:** Only click "Mark paid" after confirming the actual bank/UPI transfer has gone through, to keep records accurate.

### Frequently Asked Questions

**Q: Can Operations Managers approve a payout?**
A: No — only Founders and Finance Officers can approve, reject, or mark payouts as paid.

**Q: What happens to a partner's wallet after a payout is approved but not yet marked paid?**
A: The balance is not deducted until you click "Mark paid" — approval alone does not move any money.

---

# Part 6 — Operations

## 27. Fees & Collections

### Purpose

Tracks every participant's fee plan, records payments, issues receipt numbers, and handles corrections and discounts — all with a permanent, tamper-evident paper trail.

### Who should use this module

Finance Officers (record payments, reverse entries). Operations Managers and Founders (approve discounts). Founders (everything).

### What this module does

Maintains one fee account per enrolment, an append-only payment ledger, and installment tracking.

### Step 1 — Open Fees & Collections
Click **Fees & Collections** in the Operations menu. Two tabs: **Pending fees** and **All accounts**.


[SCREENSHOT – Fees & Collections]

### Step 2 — Review pending fees
The Pending fees tab shows every account with a balance still owed, its next due date, and whether it's overdue.

### Step 3 — Open an account
Click a participant's name (from either tab) to open their fee account: total, discount, paid, balance, and every installment with its own status (Pending, Paid, or Overdue).

### Step 4 — Record a payment
If you have collection permission, fill in the "Record a payment" card:
- **Amount (₹)** (required — cannot exceed the outstanding balance)
- **Method** — Cash, UPI, Bank transfer, Cheque, Card, or Other (required)
- **Received on** date (defaults to today)
- **Note** (optional)
Click **Record payment**. A receipt number is generated automatically (e.g. `RCP-2026-27-00001`).


[SCREENSHOT – Fees & Collections, Record a payment]

### Step 5 — Reverse an incorrect payment
Click **Reverse** next to any payment in the ledger. Type a reason of at least 10 characters explaining the correction, then confirm. **This never edits or deletes the original entry** — instead, a new negative "reversing" entry is added, so the full original history is always visible.

### Step 6 — Apply a discount (Operations Managers/Founders only)
In the "Apply discount" card, enter the **Amount (₹)** and a **Reason**, then click **Approve discount**. This cannot exceed the account's total fee.

### Expected result

A completely traceable financial record for every student, where mistakes are corrected transparently rather than hidden, and discounts always carry an approver's name.

### Important notes

> **Warning:** Discounts can never be self-approved by the same person who collects payments — Finance Officers can record and reverse payments but cannot approve their own discounts; that requires an Operations Manager or Founder. This separation is a deliberate financial control.

> **Warning:** All amounts are handled in whole paise internally (never fractional rupees), so figures are always exact.

> **Note:** There is currently **no search box or extra filter** on the Fees list beyond the two tabs.

### Common mistakes

> **Warning:** Trying to "edit" a payment directly — this is not possible by design; use Reverse instead, with a clear reason.

> **Warning:** Writing a reversal reason under 10 characters — the system requires a proper explanation.

> **Warning:** A Finance Officer attempting to approve their own discount — this button simply won't be available to that role.

### Best practices

> **Tip:** Always write a specific, clear reason when reversing a payment or applying a discount — these become permanent audit records.

> **Tip:** Record payments the same day they're received, to keep the pending-fees report accurate for the whole team.

### Frequently Asked Questions

**Q: Can I issue a partial refund?**
A: Use the Reverse action to correct a payment; there is no separate "refund" workflow distinct from reversal.

**Q: Who can see a participant's fee information?**
A: Finance Officers fully; Operations Managers and Founders can view and approve discounts. Other roles do not have fee access.

**Q: How is the receipt number generated?**
A: Automatically, in strict sequence, restarting each financial year (e.g. `RCP-2026-27-00001`).

---

## 28. Communications

### Purpose

A single, central log of every message sent to (or received from) a lead or participant — by email, SMS, or WhatsApp — so nothing said to a customer is ever lost or forgotten.

### Who should use this module

All staff roles can send and log messages. Only Founders and System Administrators can delete a logged message.

### What this module does

Records every outbound message **before** it is actually sent, and lets staff manually log conversations that happened outside the system (like a phone call).

### Step 1 — Open Communications
Click **Communications** in the Operations menu.


[SCREENSHOT – Communications]

### Step 2 — Search and filter the log
Use the search box, or filter by **Channel** (Email/SMS/WhatsApp) and **Status** (Queued/Sent/Failed).


[SCREENSHOT – Communications, Search and filter the log]

### Step 3 — Send a new message
Click **Send message**. Fill in:
- **Channel** — Email, SMS, or WhatsApp (required)
- **About** — Lead or Participant (required)
- **Recipient** — pick the specific person (required)
- **Template** (optional) — choose a ready-made template to auto-fill Subject and Message
- **Subject** (required only for Email)
- **Message** (required)
Click **Queue message**. It is logged instantly, then the system attempts delivery.

### Step 4 — Log a message that happened outside the CRM
Click **Log message**. Fill in Channel, **Direction** (Sent or Received), About, Person, optional Subject, and **What was said** (required). Click **Save to log**. This is useful for recording, for example, a WhatsApp reply that came to someone's personal phone.

### Step 5 — Delete a logged entry (Founder/System Administrator only)
Click the delete icon on a row, confirm, done. As with everything else in this system, this hides rather than truly erases the record.

### Expected result

A single, searchable history of every conversation with every lead and participant, visible on their own record too (as a read-only "Comms" section on their Lead or Participant page, if you have messaging access).

### Important notes

> **Note:** There is no "Send message" button directly on a Lead or Participant's own page — you can only view their message history there. To actually send something, go to this central Communications screen and pick the person as the recipient.

> **Note:** Ready-made templates currently exist for: enquiry acknowledgement, counselling invite, admission confirmation, fee reminder, attendance shortfall, and certificate issued.

> **Note:** A message that fails to deliver is still kept in the log with a "Failed" status — nothing is lost, and you can see it needs following up manually.

### Common mistakes

> **Warning:** Looking for a send button on an individual lead/participant page — always start from the central Communications screen instead.

> **Warning:** Forgetting to pick a Subject for an email — this is required and the form will block you.

### Best practices

> **Tip:** Use "Log message" whenever a real conversation happens through a personal phone or in person, so the full picture stays in one place.

> **Tip:** Prefer templates for routine messages — they save time and keep wording consistent.

### Frequently Asked Questions

**Q: What does "Queued" mean?**
A: The message has been logged and delivery is being attempted; it will move to "Sent" or "Failed" shortly after.

**Q: Can I send a message to a group of people at once?**
A: No — each message is sent to one specific lead or participant recipient at a time.

---

## 29. Reports

### Purpose

A catalogue of ready-made, live business reports covering the key rules TerraNext runs by.

### Who should use this module

Every role except System Administrator has some level of Reports access, scoped to only the reports that match what that role can already see elsewhere in the system.

### What this module does

Runs a fixed set of reports on demand, over the full current dataset (there is no date-range picker — every report always covers everything currently on file).

### Step 1 — Open Reports
Click **Reports** in the Operations menu. You'll only see reports relevant to modules you already have access to.


[SCREENSHOT – Reports]

### Step 2 — Run a report
Click **Run** on any report card.

### Step 3 — Export (if you have export permission)
Click **Export** to download the results as a CSV spreadsheet file. This action is itself recorded in the audit trail.

### The eight available reports

| Report | What it shows |
|---|---|
| **Batch utilisation** | How full every batch is, least-filled first |
| **Attendance risk** | Participants in a running batch who are below their required attendance % |
| **Lead source breakdown** | Leads and admissions grouped by where they came from |
| **Counselling conversion** | Leads counselled vs. admitted, and an integrity check that no one was admitted without counselling |
| **Alumni growth** | New alumni per month and the running total |
| **Duplicate-suspect leads** | Phone numbers with more than one open (unconverted) lead |
| **Placement-support funnel** | How many participants were evaluated, found eligible, and placed |
| **Growth Partner rewards** | Rewards earned and paid, per partner |

### Expected result

Fast, trustworthy answers to the standard business questions, always calculated from current, live data.

### Important notes

> **Warning:** No report currently supports choosing a date range or other filter — every report always covers the complete, current dataset.

> **Warning:** You will only ever see reports that match modules you already have permission to view — Reports never gives you a "back door" to data you couldn't otherwise see.

> **Warning:** System Administrators cannot access the Reports Centre at all today.

### Common mistakes

> **Warning:** Expecting to filter a report to a specific month — this is not currently possible; the figures are always "as of right now."

### Best practices

> **Tip:** Run the "Duplicate-suspect leads" and "Counselling conversion" reports periodically as data-quality health checks.

### Frequently Asked Questions

**Q: Why can't I see a particular report?**
A: Reports are only shown if you already have permission to view the module behind them (e.g. you need Batches access to see "Batch utilisation").

**Q: Are exports tracked?**
A: Yes — every export is itself logged in the Audit Logs (Chapter 33), recording who exported what and when.

---

## 30. Staff Notifications (What Exists Today)

### Purpose

To honestly document what happens today when the system needs to alert a staff member about something.

### What actually exists

**There is currently no in-app notification bell or notification centre for staff users.** Unlike the separate Growth Partner Portal (which does have its own notifications screen — Chapter 39), staff members are not shown a running list of alerts inside the CRM itself.

Instead, today, staff are informed through:
- **Email** — for example, a welcome email when a new staff account is created (Chapter 31), or a password reset link.
- **On-screen confirmation messages ("toasts")** — small pop-up confirmations that appear immediately after you personally complete an action (e.g. "Payment recorded," "Certificate issued"). These only relate to your own immediate action and disappear after a few seconds — they are not a persistent inbox.

### Important notes

> **Warning:** If you were expecting a bell icon or notification list somewhere in the staff app, it does not exist in the current build — this is not a bug, simply a feature not yet built.

> **Note:** To stay informed of things that matter to your role (new leads, pending fees, admissions ready to convert), check the relevant module screen directly, or your Dashboard (Chapter 6).

---

# Part 7 — Administration

## 31. Users

### Purpose

Where staff accounts are created and managed. This is the **only** way anyone ever gets access to the CRM — there is no public sign-up.

### Who should use this module

System Administrators (full control) and Founders. No other role can see this screen.

### What this module does

Lists every staff account, its role, and its status, and provides the tools to invite new staff, change roles, and enable/disable accounts.

### Step 1 — Open Users
Click **Users** in the Administration menu.


[SCREENSHOT – Users]

### Step 2 — Invite a new staff member
Click **Invite staff member**. Fill in:
- **Full name** (required)
- **Email** (required)
- **Phone** (required, international format)
- **Role** (required — choose from the 8 roles, defaults to Trainer)
Click **Create account**.


[SCREENSHOT – Users, Invite a new staff member]

### Step 3 — Share the password-reset link
After creating the account, a one-time password-reset link is shown on screen (valid for about 1 hour). Click **Copy** to copy it, and share it with the new staff member yourself — **this link is only ever shown this once**, so copy it immediately. A welcome email containing the same link is also sent automatically.

### Step 4 — Change someone's role
On the Users list, use the **Role** dropdown next to their name (only available if you have permission, and never for your own account). The change takes effect immediately — the person may need to sign in again for it to fully apply.

### Step 5 — Disable or enable an account
Click **Disable** to immediately and completely block someone from signing in (they are also signed out of any existing session right away), or **Enable** to restore access.

### Expected result

Full, controlled visibility over exactly who can access the CRM and with what role, at all times.

### Important notes

> **Warning:** There is no self-registration anywhere in this system — every single account starts here.

> **Warning:** There is no delete-user action — accounts can only be disabled (reversible) or have their role changed, never permanently removed.

> **Warning:** You **cannot** change your own role or disable your own account — ask another System Administrator or Founder.

> **Warning:** The system will not let you demote or disable the **very last** remaining System Administrator or Founder account — promote another account to that role first.

### Common mistakes

> **Warning:** Losing the one-time password-reset link before sharing it — if this happens, there is no way to view it again; you'll need to trigger a normal "Forgot password" from the sign-in page instead.

> **Warning:** Trying to change your own role — the system blocks this on purpose.

### Best practices

> **Tip:** Assign the most limited role that still lets someone do their job — this is safer and reduces mistakes.

> **Tip:** Disable an account immediately when someone leaves the organisation, rather than waiting.

### Frequently Asked Questions

**Q: What happens if I lose the reset link?**
A: The new staff member can use "Forgot password?" on the sign-in page instead, once their account exists.

**Q: Can a Founder be disabled?**
A: Only if at least one other active Founder or System Administrator remains — the system will not let the very last one be disabled or demoted.

---

## 32. Roles & Permissions (Admin Screen)

### Purpose

Shows exactly what every role is allowed to do, across every module, in one place.

### Who should use this module

Founders and System Administrators.

### What this module does

A **read-only** reference table — it cannot be edited from here.

### Step 1 — Open Roles & Permissions
Click **Roles & Permissions** in the Administration menu.


[SCREENSHOT – Roles & Permissions]

### Step 2 — Read the matrix
Each row is a module (Leads, Fees, Certificates, etc.); each column is a role. Small coloured tags in each cell show exactly which abilities (View, Create, Update, Delete, Assign, Approve, Export, Configure) that role has for that module. A dash means no access at all.

### Expected result

A complete, always-accurate picture of the permission system — useful whenever you're unsure why someone can or cannot do something.

### Important notes

> **Warning:** This screen cannot be edited. Changing what a role can do requires a formal, reviewed change to the underlying system by the technical team — this is a deliberate safeguard against accidental or unreviewed permission changes.

> **Warning:** A version code shown at the bottom of the page changes whenever the underlying permission rules change, so you can visually confirm if anything has been updated since you last checked.

### Common mistakes

> **Warning:** Looking for an "Edit" or "Save" button on this page — there isn't one, by design.

### Best practices

> **Tip:** Refer to this page whenever training a new staff member, so they understand exactly what their role can and cannot do.

### Frequently Asked Questions

**Q: Can I request a permission change?**
A: Yes, but it must go through the technical team as a reviewed change — it cannot be toggled directly in the app.

---

## 33. Audit Logs

### Purpose

An unchangeable historical record of every important action taken anywhere in the CRM — who did what, to which record, and when.

### Who should use this module

Founders and System Administrators.

### What this module does

A searchable, filterable stream of every logged event, with ready-made views for common compliance questions.

### Step 1 — Open Audit Logs
Click **Audit Logs** in the Administration menu.


[SCREENSHOT – Audit Logs]

### Step 2 — Use a ready-made view
Click one of the preset buttons at the top:
- **All Events**
- **Access Authorisation** — permission and role changes
- **System Access Log** — sign-ins
- **Overrides** — admin exceptions with a recorded reason
- **Data Exports** — every time data was exported from the system

### Step 3 — Or build your own filter
Choose an **Action** (Create, Update, Status change, Permission change, Login, Export, Override, etc.), an **Entity type** (Lead, Participant, Certificate, and so on), and a **Date from / Date to** range.

### Step 4 — Read an entry
Each row shows: when it happened, who did it (and their role), what action, which record, exactly what changed (before → after, where applicable), and any recorded reason.

### Step 5 — Export the current view
Click **Export CSV** (only visible if you have export permission) to download exactly what's currently filtered on screen. This export is itself immediately logged as a new audit entry.

### Expected result

A complete, trustworthy paper trail suitable for compliance review, dispute resolution, or simply understanding what happened to a record and why.

### Important notes

> **Warning:** The audit log can never be edited or deleted, by anyone, including Founders — it is permanent by design.

> **Note:** The list is capped at showing the most recent 500 matching entries at once — narrow your filters if you need to look further back.

> **Warning:** There is currently no way to click through from an audit entry directly to the record it refers to — you'll need to search for that record separately in its own module.

### Common mistakes

> **Warning:** Expecting to filter by a specific staff member's name directly — this filter option is not currently available (only Action, Entity type, and Date range are).

### Best practices

> **Tip:** Use the "Overrides" preset periodically to review every exception made anywhere in the system and confirm each one had a sound reason.

### Frequently Asked Questions

**Q: Can an audit entry ever be wrong or altered?**
A: No — entries are permanent and immutable from the moment they are written.

**Q: Is exporting audit logs itself tracked?**
A: Yes — every export creates its own new audit log entry.

---

## 34. Settings

### Purpose

Organisation-wide configuration — your company details, visual branding, the numbering formats used for auto-generated IDs, and the Growth Partner recognition tiers.

### Who should use this module

System Administrators can view and edit everything on this screen; Founders can view it (edit rights follow the same System-Administrator-level permission). No other role can see this screen.

### What this module does

Five sections, in order: **Organisation**, **Branding**, **ID Formats**, **Academies & Programmes** (a link out to Chapter 13, not edited here), and **Leadership Levels**.

[SCREENSHOT – Settings Page, Full Overview]

### Step 1 — Open Settings
Click **Settings** in the Administration menu.


[SCREENSHOT – Settings]

### Step 2 — Edit Organisation details
Update **Organisation name** (required); **Tagline**, **Address**, **Contact email**, **Contact phone**, **Website**, **GST number**, **PAN number**, **Google Maps URL**, and **Social links** (all optional). These details appear on issued certificates and in outgoing communications (Chapter 28). Click **Save**.

> **Note:** GST and PAN numbers are kept internal — they are never shown on the public website or in the certificate-verification lookup.

### Step 3 — Edit Branding
Update the **Primary**, **Secondary**, and **Accent** colours (used across the website, emails, and certificates), plus five separate logo images: the main **site logo**, **favicon**, **email logo**, **certificate logo**, and **QR-code logo**. Click **Save**.

[SCREENSHOT – Settings Page, Branding Section]

> **Note:** These five logo slots are deliberately separate — a certificate, a QR code, and an email do not always suit the exact same image (for example, a QR-code logo usually needs to be simple enough to stay scannable when small), so each can be set independently.

### Step 4 — Edit ID Formats
Update the prefixes used for every auto-generated ID in the system:
- **Participant ID prefix** (default `TNX`, e.g. produces `TNX-2026-00042`)
- **Certificate number prefix** (default `TNXC`, e.g. `TNXC-2026-00107`)
- **Receipt number prefix** (default `RCP`, e.g. `RCP-FY26-00001` — this one resets its running number every financial year; the others never reset)
- **Community Partner ID prefix** (default `TCGN`, e.g. `TCGN-000001`)
- **Growth Partner ID prefix** (default `TGP`, e.g. `TGP-000001`)
Click **Save**.

[SCREENSHOT – Settings Page, ID Formats Section]

### Step 5 — Academies & Programmes
This card is a shortcut only — click **Open catalogue** to go to the Programmes screen (Chapter 13), where academies and programmes are actually created and edited. Nothing is configured directly from this Settings screen for them.

### Step 6 — Manage Leadership Levels
In the **Leadership Levels** card, click **New level** to add a partner recognition tier: **Name**, **Description**, **Display order** (lower numbers show first, and the lowest-order *active* tier becomes the automatic starting tier for every newly approved partner — Chapter 23), and a **Badge colour**. Use **Edit** to update an existing tier, or **Archive** to retire one without losing history (archived tiers are never deleted, and any partner already on an archived tier keeps showing it until moved).

[SCREENSHOT – Settings Page, Leadership Levels Section]

### Expected result

Organisation-wide details, visual identity, and ID numbering stay accurate and consistent everywhere they're used, and Growth Partners are recognised using tiers that genuinely reflect how your organisation wants to structure them — not a fixed, generic scale.

### Important notes

> **Warning:** Changing an ID prefix never changes IDs that already exist — it only affects new records created from that point onward.

> **Note:** Every settings change is recorded in the Audit Logs.

> **Warning:** Notification/email template editing does not currently exist as a screen — templates are fixed in the system's code today (see Chapter 28).

> **Note:** Leadership Levels configured here are what Chapter 23's "Leadership level" dropdown offers — the two screens are directly connected.

### Common mistakes

> **Warning:** Expecting a prefix change to retroactively rename existing Participant IDs, certificates, receipts, or partner IDs — it will not; only new ones are affected.

> **Warning:** Deleting a Leadership Level instead of archiving it — there is no delete option, only Archive, precisely so existing partners never lose their assigned tier's name.

### Best practices

> **Tip:** Decide on your ID prefixes early and avoid changing them later, to keep numbering intuitive across years.

> **Tip:** Keep Leadership Level names short and motivating — they are shown to partners themselves on their own Dashboard (Chapter 36).

### Frequently Asked Questions

**Q: Can I edit notification/email templates here?**
A: Not currently — this screen covers Organisation details, Branding, ID Formats, and Leadership Levels; message templates are fixed in the system today (Chapter 28).

**Q: Where do I actually create or edit an academy or programme?**
A: Not on this screen — click **Open catalogue** in the Academies & Programmes card to go to the Programmes screen (Chapter 13).

---

# Part 8 — The Growth Partner Portal

> Everything in this Part is a **separate application from the staff CRM** — Growth Partners and Growth Community Business partners sign in at a different web address, and can never see any staff screen. Likewise, staff cannot sign into the partner portal.

## 35. Partner Login

### Purpose

The secure entry point for referral partners.

### Who should use this module

Any approved Growth Partner or Growth Community Business partner.

### What this module does

A dedicated sign-in page, separate from the staff CRM.

### Step 1 — Open the Partner Portal sign-in page
Go to the Partner Portal web address (different from the staff CRM address).


[SCREENSHOT – Partner Login]

### Step 2 — Sign in
Enter your **Email** and **Password**, then click **Sign in**.

### Expected result

You land on your **Partner Dashboard**.

### Important notes

> **Warning:** You cannot sign in until your application has been approved by TerraNext staff (Chapters 22/23). Before approval, no account exists yet.

> **Note:** Once approved, you will receive a "set your password" email — use that link to create your password before your first sign-in.

> **Note:** The same "Forgot password?" and lockout protections described in Chapter 5 apply here too.

### Common mistakes

> **Warning:** Trying to sign in immediately after registering, before receiving an approval email — please wait for approval first.

### Frequently Asked Questions

**Q: I registered but never got an approval email. What do I do?**
A: Contact TerraNext support (Chapter 53) — your application may still be pending review.

---

## 36. Partner Dashboard

### Purpose

Your personal summary of your referral performance and earnings.

### Who should use this module

Every signed-in partner.

### What this module does

A read-only overview screen.

### Step 1 — Sign in
You land here automatically.


[SCREENSHOT – Partner Dashboard]

### Step 2 — Review your numbers
- Your **Status** (Pending approval / Active / Suspended / Rejected) and **Leadership level** (a named tier your organisation defines — not a fixed universal scale; see Chapter 23)
- Total leads you've referred
- Pending leads (still early in the pipeline)
- Leads currently in counselling
- Successful leads (those who were admitted)
- Rewards earned, rewards paid, and rewards still pending
- Your current wallet balance
- Unread notification count
- Your rank on the leaderboard

### Expected result

A quick, honest picture of how your referrals are performing and what you've earned.

### Important notes

> **Note:** This page is view-only — to take any action, use the other menu items (My Leads, My Rewards, etc.)

### Frequently Asked Questions

**Q: How often do these numbers update?**
A: They are calculated live every time you open the page.

---

## 37. My Leads (Partner Portal)

### Purpose

Submit new referrals and track exactly what stage each one has reached.

### Who should use this module

Every signed-in partner.

### What this module does

Lists every referral you've personally submitted, with a status timeline for each.

### Step 1 — Open My Leads
Click **My Leads** in the portal menu.


[SCREENSHOT – My Leads]

### Step 2 — Refer a new lead
Click **Refer a lead**. Fill in:
- **Name** (required)
- **Phone** (required, international format e.g. `+919876543210`)
- **Email** (optional)
- **Programme interest** (optional)
- Tick the box confirming **the lead has consented to being contacted** (required)
Click **Submit**.


[SCREENSHOT – My Leads, Refer a new lead]

### Step 3 — Track a referral
Click any lead's name to see a step-by-step timeline: Lead submitted → Assigned → Counselling → Application → Admission → Payment pending → Payment successful → Reward generated → Reward paid.

### Expected result

Every referral you submit is tracked from first contact all the way to your reward being paid, transparently.

### Important notes

> **Warning:** Your account must be Active to refer a lead — a suspended or not-yet-approved account cannot submit referrals.

> **Warning:** Consent is mandatory — you must confirm the person agreed to be contacted before you can submit their details.

> **Warning:** You can only see and refer leads under your own name — never another partner's referrals.

### Common mistakes

> **Warning:** Forgetting to tick the consent box — the form will not submit without it.

> **Warning:** Entering a phone number that isn't in the correct international format (must start with a `+` and country code).

### Best practices

> **Tip:** Submit referrals as soon as possible after speaking with someone, while their interest is fresh.

### Frequently Asked Questions

**Q: Why hasn't my referral's status changed?**
A: Status updates happen as TerraNext staff work the lead — contact TerraNext if a referral seems stuck for an unusually long time.

**Q: Can I edit a referral after submitting it?**
A: No — referrals cannot be edited once submitted.

---

## 38. My Rewards (Partner Portal)

### Purpose

See your reward history, wallet balance, and request to be paid out.

### Who should use this module

Every signed-in partner.

### What this module does

Displays your wallet balance, a full reward history table, and past payout requests.

### Step 1 — Open My Rewards
Click **My Rewards** in the portal menu.


[SCREENSHOT – My Rewards]

### Step 2 — Review your wallet and pending rewards
See your current **Wallet balance** and **Pending rewards** at the top.

### Step 3 — Review your reward ledger
Every individual reward you've earned is listed, with its status (Accrued, Paid, or Clawed back) and when it was recorded.

### Step 4 — Request a payout
Click **Request payout** (only enabled if your wallet balance is greater than zero, and you don't already have a request in progress). This requests your **entire current balance** — you cannot request a partial amount.

### Expected result

A transparent view of everything you've earned, and a simple one-click way to request your money.

### Important notes

> **Note:** You can only have **one payout request in progress at a time**.

> **Warning:** A payout always requests your **full available balance** — there is no option to request less.

> **Note:** "Clawed back" means a reward was reversed, usually because the original payment it was based on was later reversed by TerraNext (for example, a refund).

### Common mistakes

> **Warning:** Trying to submit a second payout request while one is already pending — the button will be disabled.

### Best practices

> **Tip:** Check back periodically to see your payout request move from Requested → Approved → Paid.

### Frequently Asked Questions

**Q: Can I request only part of my balance?**
A: No — every payout request is always for your full current balance.

**Q: How long does a payout take?**
A: This depends on TerraNext staff review and actual bank transfer time; there is no fixed automatic timeline shown in the system.

---

## 39. Partner Notifications

### Purpose

Keeps you informed about updates to your referrals and rewards.

### Who should use this module

Every signed-in partner.

### What this module does

A simple list of update messages, most recent first.

### Step 1 — Open Notifications
Click **Notifications** in the portal menu.


[SCREENSHOT – Partner Notifications]

### Step 2 — Read your updates
Each entry shows a message and how long ago it happened.

### Expected result

You stay informed as your referrals progress and rewards are generated, without needing to check every screen manually.

### Important notes

> **Note:** There is currently no button to mark a notification as read on this screen — the "unread" count shown on your Dashboard is calculated automatically in the background.

### Frequently Asked Questions

**Q: Will I also get these updates by email?**
A: Some events (like approval) send a separate email; day-to-day referral progress updates appear here in the portal.

---

## 40. Partner Profile

### Purpose

Edit your own contact details.

### Who should use this module

Every signed-in partner — both individual **Growth Partners** and **Growth Community Business** partners.

### What this module does

A simple self-service edit form. The fields shown depend on which kind of partner you are.

### Step 1 — Open Profile
Click **Profile** in the portal menu.


[SCREENSHOT – Partner Profile]

### Step 2 — Update your details
- **If you are an individual Growth Partner:** edit your **Name**, **Phone**, and **Organisation** (optional).
- **If you are a Growth Community Business:** edit your **Business name**, **Contact person**, and **Phone**.

Click **Save changes**.

### Expected result

Your contact details stay current for TerraNext staff to reach you.

### Important notes

> **Note:** The form shown is automatically matched to your partner type — you don't need to choose anything; it just works correctly for whichever kind of account you have.

### Frequently Asked Questions

**Q: Can I change my email address here?**
A: No — email address changes are not available on this form; contact TerraNext support if you need this updated.

**Q: I'm a Growth Community Business partner — why don't I see an "Organisation" field the way individual partners do?**
A: Your business's name **is** your "Organisation" field — it's simply labelled **Business name** for your account type, alongside a **Contact person** field individual partners don't have.

---

## 41. Partner QR Code

### Purpose

Provides a scannable QR code every approved partner can display to generate referrals effortlessly.

### Who should use this module

**Every approved partner** — both individual **Growth Partners** and **Growth Community Business** partners. Both kinds get their own personal QR code once approved; this is not limited to businesses.

### What this module does

Generates a downloadable QR code image linked to your own unique referral code.

### Step 1 — Access your QR code
Go to the **QR Code** page in your Partner Portal menu. Your QR code and download options are shown directly there — you do not need to ask TerraNext staff for it, although staff can also download and share it on your behalf from your profile page in the CRM (Chapter 23 for individual Growth Partners, Chapter 24 for Growth Community Business partners).


[SCREENSHOT – Partner QR Code]

### Step 2 — Download
Download as **PNG** (for printing/sharing as an image) or **SVG** (for high-quality printing at any size).

### Expected result

A ready-to-print or ready-to-share QR code that sends anyone who scans it straight to the TerraNext application form, with your referral automatically credited to you.

### Important notes

> **Note:** Only available **after** your application is approved — a pending application has no QR code yet.

> **Note:** Individual Growth Partners can also simply share their details directly using the "Refer a lead" form (Chapter 37) instead of relying on the QR code — both routes credit the referral to you correctly.

### Frequently Asked Questions

**Q: What happens if someone scans an old or invalid QR code?**
A: They are still sent to the general application page — it simply won't credit a referral to any partner.

**Q: I'm an individual Growth Partner — do I really have my own QR code too, not just businesses?**
A: Yes. Every approved partner, individual or business, gets their own personal QR code from the moment they're approved.

---

# Part 9 — The Public Website

> These forms live on the public TerraNext marketing website (open to anyone, no sign-in). They are included here because every one of them creates a record directly inside the CRM — understanding them helps staff understand exactly where every lead and partner application comes from.

## 42. Student Application Form

### Purpose

The main "Apply Now" form on the public website, where prospective students formally apply.

### Who should use this module

Members of the public — prospective students, parents applying on their behalf, or working professionals.

### What this module does

Collects an applicant's details and creates a new Lead automatically inside the CRM (Chapter 7), ready for a Transformation Consultant to follow up.

### Step 1 — Open the Apply page
Visit the TerraNext website and go to the Apply page.


[SCREENSHOT – Student Application Form]

### Step 2 — Fill in personal information
**Full Name** (required); Date of Birth, Gender, Nationality (all optional).

### Step 3 — Fill in contact information
**Mobile Number** (required), **Email Address** (required); Address, City, State, Postal Code (optional).

### Step 4 — Fill in educational background (optional)
Highest Qualification, Institution Name, Year of Completion.

### Step 5 — Fill in professional information (optional)
Current Occupation, Organization, Years of Experience.

### Step 6 — Choose programme details
**Academy** (required — normally shows the live list of academies currently configured by TerraNext staff in the CRM's Programmes screen (Chapter 13), typically including NextGen Transformation Academy, Family Transformation Academy, Faculty Development Academy, Career & Global Placement Academy, AI Career Accelerator, and NextStep — see the note below); Programme, Preferred Learning Mode, Preferred Batch, Preferred Start Date (all optional).

### Step 7 — Statement of purpose (optional)
A short free-text box to explain your interest.

### Step 8 — Confirm and consent
Tick both required boxes: confirming the information is accurate, and agreeing to the Privacy Policy and Terms & Conditions.

### Step 9 — Submit
Click **Submit Application**.

### Expected result

A confirmation message: "Application received," explaining an acknowledgement email will follow and the admissions team will be in touch. Behind the scenes, a new Lead has already appeared in the CRM.

### Important notes

> **Warning:** If you've already applied before with the same mobile number, the system does **not** reject your new application — it updates your existing record and reopens it if it had gone cold, so your enquiry is never lost.

> **Note:** If you arrived via a partner's referral link or QR code, your application is automatically credited to that partner — you don't need to do anything extra.

> **Note:** The Academy list on this form is pulled live from what TerraNext staff have configured in the CRM (Chapter 13) at the moment the page loads — so it always reflects current offerings. If the CRM cannot be reached at that exact moment, the website falls back to a built-in standard list instead, which is kept similar but is not guaranteed to be perfectly identical to what is currently configured.

### Common mistakes

> **Warning:** Leaving required fields (Name, Mobile, Email, Academy, both consent boxes) empty — the form will show a clear message and won't submit until they're filled in.

> **Warning:** Entering a mobile number without enough digits.

### Best practices

> **Tip:** Fill in as many optional fields as you comfortably can — the more TerraNext's team knows upfront, the more useful your first conversation with them will be.

### Frequently Asked Questions

**Q: How soon will someone contact me?**
A: The confirmation message states the admissions team will reach out with next steps; exact timing depends on TerraNext's team.

**Q: Can I submit more than one application?**
A: Yes, but applications with the same mobile number are treated as one ongoing enquiry rather than separate new ones.

---

## 43. Contact Form & Application Pop-up

### Purpose

Two additional, simpler ways to get in touch from the public website — a general Contact form, and a shorter "Application" pop-up that appears as a call-to-action across the site.

### Who should use this module

Anyone with a general question, or anyone who wants to start an enquiry quickly without the full application form.

### What this module does

Both create a Lead in the CRM, just like the full Application form, but with fewer fields.

### Step 1 — Contact Form (`/contact` page)
Fill in Full Name, Email Address, Phone Number, Subject, and Message (all required), plus Organization (optional). Tick the required Privacy Policy/Terms agreement box. Click **Submit Enquiry**.


[SCREENSHOT – Contact Form & Application Pop-up]

### Step 2 — Application Pop-up (site-wide quick enquiry)
Fill in Full Name, Email, Phone Number (all required); Current Status (School Student / College Student / Working Professional / Parent / Faculty) and Interested Academy and City (all optional). Click **Submit Application**.

### Expected result

- Contact Form: "Thank you for reaching out," with an expectation of a response within 1–2 business days.
- Application Pop-up: "Application Submitted Successfully," with an **Explore Programs** button and a **Contact Us** button.

### Important notes

> **Warning:** The Contact Form always creates a general-purpose enquiry lead — it does not ask who the enquiry is for, so it is always logged simply as "Other."

> **Note:** The Application Pop-up does not show a consent checkbox to the visitor, but their consent is still recorded automatically as part of submitting the form.

### Frequently Asked Questions

**Q: What's the difference between this and the full Application form?**
A: These are shorter and faster — ideal for a quick question or first point of contact; the full Application form (Chapter 42) is more detailed and programme-focused.

---

## 44. Growth Partner Registration (Public)

### Purpose

Where an individual applies to become a TerraNext Growth Partner (referral partner).

### Who should use this module

Any individual interested in referring people to TerraNext and earning rewards.

### What this module does

Submits an application that appears in the staff CRM's Growth Partners screen (Chapter 23) as "Pending approval."

### Step 1 — Open the registration page
Visit the TerraNext website's Growth Partner registration page.


[SCREENSHOT – Growth Partner Registration]

### Step 2 — Fill in personal details
**Full Name** (required); Date of Birth, Gender (optional).

### Step 3 — Fill in contact information
**Mobile Number** and **Email Address** (both required).

### Step 4 — Fill in address, education, and occupation (all optional)
Address/City/State/Postal Code; Highest Qualification/Institution/Year; Current Occupation/Organization/Years of Experience.

### Step 5 — Choose areas of interest (optional)
Tick any that apply: Community Outreach, Sales & Growth, Training & Mentorship, Digital Marketing, Events & Campus Engagement, Corporate Partnerships.

### Step 6 — Preferences (optional)
Preferred Working Location, Languages Known, Referral Code (if someone referred you to become a partner).

### Step 7 — Documents (optional at this stage)
You may optionally attach a photo and identity proof here, but this is not required to submit — verified copies are collected separately later, during the verification stage.

### Step 8 — Declare and submit
Tick the declaration checkbox agreeing to the Programme Terms & the Privacy Policy, then click **Submit Registration**.

### Expected result

A confirmation screen: "Application received," showing the six-step journey ahead — Application Submitted → Verification → Orientation → Training → CRM Access → Active Growth Partner.

### Important notes

> **Warning:** You cannot sign in immediately after registering. No login exists until TerraNext staff review and approve your application (Chapter 23) — you will then receive an email to set your password.

> **Note:** If you use the same email to register twice, the system will tell you an application already exists for that email.

> **Note:** Any photo/ID file you attach at this stage is only noted by filename for staff reference — it is not the final verified document upload; that happens later in the process, as explained on the confirmation screen.

> **Note for staff reading applications:** Only Full Name, Email, Phone, and Organisation arrive in the CRM as separate, structured fields (visible directly on the partner's profile, Chapter 23). Everything else on this form — areas of interest, preferred location, languages, referral code, qualification, occupation — is combined into a single free-text "Application notes" block on the partner's profile, not shown as individual fields. Read the notes in full when reviewing an application.

### Common mistakes

> **Warning:** Expecting instant portal access after submitting — approval by TerraNext staff always comes first.

### Frequently Asked Questions

**Q: How long does approval take?**
A: This depends on TerraNext's review process; you'll receive an email once a decision is made.

**Q: What if I don't have a referral code?**
A: It's optional — simply leave it blank.

---

## 45. Growth Community Business Registration (Public)

### Purpose

Where a business (gym, café, tuition centre, and similar) applies to join the Community Growth Network.

### Who should use this module

Any business or organisation wanting to refer customers/members to TerraNext and earn rewards.

### What this module does

Submits an application that appears in the staff CRM's Growth Community Business screen (Chapter 24) as "Pending approval."

### Step 1 — Open the registration page
Visit the TerraNext website's Community Growth Network registration page.


[SCREENSHOT – Growth Community Business Registration]

### Step 2 — Fill in business details
**Organization Name** (required) and **Business Category** (required — choose from Gym, Beauty Salon, Yoga Centre, Dance Academy, Tuition Centre / Educational Institute, Hospital, Clinic, Café, Apartment Association, NGO, Corporate Organisation, or Other).

### Step 3 — Fill in contact person details
**Contact Person**, **Phone Number**, **Email Address** (all required).

### Step 4 — Add notes (optional)
Describe your business and how you'd like to refer people to TerraNext, in up to 1000 characters.


[SCREENSHOT – Growth Community Business Registration, Add notes]

### Step 5 — Submit
Click **Submit Application**.

### Expected result

A confirmation screen: "Application received," showing the five-step journey ahead — Application Submitted → Application Review → Approval → Partner Login → Start Referring.

### Important notes

> **Note:** Duplicate checks are stricter here than for individual partners — the system checks your email, phone number, **and** business name, and will reject the application with a clear message if any of the three is already registered.

> **Note:** Your Partner ID and QR code (Chapter 41) are only created once TerraNext approves your application — they do not exist yet at registration.

### Common mistakes

> **Warning:** Registering the same business twice under slightly different names — the system may still catch this via matching phone/email even if the name differs slightly.

### Frequently Asked Questions

**Q: When do we get our QR code?**
A: Only after approval — check Chapter 41 for how to access it once approved.

**Q: Can more than one person from our business get a login?**
A: The current system registers one account per business application; contact TerraNext support for guidance on multi-user needs.

---

## 46. Referral Links & QR Scans

### Purpose

Explains what happens when someone clicks a partner's referral link or scans their QR code.

### Who should use this module

Anyone referred by a Growth Partner or Growth Community Business.

### What this module does

Instantly redirects the visitor to the public Apply page, with the referral automatically remembered so it can be credited once they submit an application.

### Step 1 — Click the link or scan the QR code
The visitor is taken straight to the TerraNext Apply page (Chapter 42).


[SCREENSHOT – Referral Links & QR Scans]

### Step 2 — Fill in and submit the Application form
The referral is automatically carried through in the background — the visitor does not need to type any referral code manually.

### Expected result

The referring partner's account is automatically credited once the resulting lead is admitted and paid for — feeding directly into their Rewards (Chapter 38).

### Important notes

> **Warning:** Even a mistyped, old, or otherwise invalid referral code still sends the visitor to the Apply page normally — it simply won't credit any partner, and the applicant's own enquiry is never blocked or lost.

> **Note:** The actual credit to a partner only happens once the applicant's details are actually submitted through the Apply form — visiting the link alone does not create a lead by itself.

### Frequently Asked Questions

**Q: What if I lose the referral link but still want to apply through a specific partner?**
A: Simply apply through the normal Apply page (Chapter 42) and mention the partner's name in the Statement of Purpose field, then contact TerraNext staff to confirm the referral is credited correctly.

---

## 47. Website & CRM Integration

### Purpose

This chapter pulls together, in one place, exactly how the public TerraNext website and the staff CRM connect — since every chapter in Part 9 covered one form at a time, this is the "big picture" view of what happens automatically, with no retyping, no manual export/import, and no delay.

### Who should use this chapter

Anyone who wants to understand where a Lead, Growth Partner application, or Community Business application actually comes from, and confirm nothing needs to be manually copied between systems.

### The two systems, in plain terms

- **The public TerraNext website** is a completely separate application from the CRM, with its own address, built for visitors — prospective students, parents, and businesses. Nobody signs in to use it.
- **The CRM (this system)** is the private, staff-only application everything in Parts 1–8 of this manual describes.

They are built and run as two separate pieces of software — but they are wired together so that certain website actions write directly into the CRM the moment they happen.

[SCREENSHOT – Diagram: Website and CRM as Two Connected Systems]

### What flows from the website into the CRM, automatically

| On the website | Lands in the CRM as | Chapter |
|---|---|---|
| Student Application ("Apply Now") form submitted | A new Lead (or an update to an existing one, if the phone number already matches) | 7, 42 |
| Contact form submitted | A new Lead, logged generically | 7, 43 |
| Site-wide "Application" pop-up submitted | A new Lead | 7, 43 |
| Growth Partner registration submitted | A new Growth Partner record, status "Pending approval" | 23, 44 |
| Growth Community Business registration submitted | A new Community Business record, status "Pending approval" | 24, 45 |
| A visitor scans/clicks a partner's QR code or referral link, then applies | A new Lead, automatically credited to that partner | 46 |

### What flows from the CRM out to the website, live

Not everything is one-directional. A few things staff configure inside the CRM are read live by the website every time a visitor loads a page:

- **The Academy list** on the Apply form and the Application pop-up (Chapter 13's Programmes screen controls this)
- **Organisation and branding details** shown on the website (contact details, address, colours, logo — Chapter 34's Settings screen controls this)

[SCREENSHOT – Diagram: Settings and Catalogue Feeding the Public Website]

### Step-by-step: what actually happens the instant someone applies

1. A visitor fills in and submits a form on the public website (any of the forms in Part 9).
2. The website sends that information straight to the CRM in the background — the visitor never sees this happen, and there is no delay for them to wait through beyond the normal page response.
3. The CRM checks whether this phone number already has an existing Lead. If yes, it updates that Lead instead of creating a duplicate. If no, a brand-new Lead is created immediately, with its Source already correctly marked (e.g. "Website," or "Referral" if a partner's code was attached).
4. If the visitor provided an email address, an automatic acknowledgement email is queued and usually sent within moments (Chapter 28).
5. The new or updated Lead appears immediately in the CRM's Leads screen (Chapter 7) — there is nothing for staff to "sync," "import," or "refresh" to make it appear.

### Expected result

Every enquiry or application, submitted through any public form, becomes a trackable CRM record within moments — with no manual data entry, no spreadsheet exports, and no risk of an enquiry being lost between systems.

### Important notes

> **Note:** The two systems are genuinely separate pieces of software with separate addresses — this is why, for example, an Operations Manager cannot "log in to the website" from inside the CRM, and a website visitor never sees anything that looks like the staff CRM.

> **Warning:** If the CRM is briefly unreachable at the exact moment a visitor loads the Apply page, the Academy dropdown falls back to a built-in standard list rather than failing outright — see the note in Chapter 42.

> **Note:** None of this integration requires any action from staff to "turn on" or maintain day to day — it runs automatically, every time, for every form.

### Common mistakes

> **Warning:** Assuming a website enquiry needs to be manually re-entered into the CRM — it never does; if a Lead is missing, see "Lead Missing" in Chapter 49's Troubleshooting Guide rather than re-creating it by hand.

### Frequently Asked Questions

**Q: Can staff submit a form directly to the website to test it?**
A: Yes — anyone can visit the public website like any other visitor. Submitting a real form there creates a real Lead or partner application in the live CRM, so use realistic test data sparingly and let a System Administrator know if you do this, so the test record can be identified and cleaned up.

**Q: If we update our Academy list in the CRM, how fast does the website reflect it?**
A: Immediately — the website reads the current list fresh every time the Apply page or Application pop-up loads; there is no publishing delay.

---

# Part 10 — Reference

## 48. Workflow Diagrams (All Modules)

Simple visual summaries of how information flows through the system. Follow the arrows top to bottom.

### The core student journey

```
Website / Referral / Walk-in / Phone
              ↓
            Lead created
              ↓
     Counselling session recorded
     (must "recommend" a named programme)
              ↓
      Lead reaches Hot / Counselling-attended
              ↓
        Admissions queue (BR-02 checklist passes)
              ↓
       Convert Lead → Participant
       (permanent Participant ID issued)
              ↓
      Enrolment created + Fee account opened
              ↓
        Batch allocated (optional at first)
              ↓
   Attendance marked + Assessments scored
              ↓
     Certificate eligibility checked automatically
              ↓
        Certificate issued
              ↓
         Alumni status granted automatically
              ↓
  Career Interest → Eligibility decision → Placement
```

### Growth Partner (individual) journey

```
Applies on public website
(Growth Partner Registration Form)
              ↓
   Appears in CRM as "Pending approval"
              ↓
   TerraNext staff Approve or Reject
              ↓ (if approved)
Login account created + welcome email sent
              ↓
     Partner signs in to Partner Portal
              ↓
      Partner refers leads ("Refer a lead")
              ↓
   Referred lead follows the normal student journey
              ↓
  When referred participant's payment is recorded,
     a Reward is generated automatically
              ↓
   Partner requests a Payout (full balance)
              ↓
    TerraNext Approves / Rejects, then Marks Paid
```

### Growth Community Business journey

```
Business applies on public website
(Community Business Registration Form)
              ↓
   Appears in CRM as "Pending approval"
              ↓
   TerraNext staff Approve or Reject
              ↓ (if approved)
 Human-readable Partner ID minted (e.g. TCGN-000001)
 + QR code generated + login created
              ↓
    Business displays/shares their QR code
              ↓
     Someone scans the QR code
              ↓
 Redirected to public Apply page, referral remembered
              ↓
    Visitor submits the Application form
              ↓
      Lead created, credited to this business
              ↓
   Same reward → payout flow as an individual partner
```

### Attendance journey

```
Batch is Planned or Running
              ↓
   Session held on the scheduled day
              ↓
  Trainer/Coordinator opens the session in Attendance
              ↓
  Each participant tapped: Present / Absent / Late / Excused
              ↓
        Click "Save attendance"
              ↓
Attendance % recalculated automatically for each participant
              ↓
Feeds into Certificate eligibility (BR-03) and Reports
```

### Certificates journey

```
Enrolment reaches "In progress" or "Completed"
              ↓
System continuously compares live Attendance % and
   Assessment average against the programme's rules
              ↓
        Eligible? ──── No ───→ Reasons listed; Operations Manager
              │                may Override with a written reason
             Yes
              ↓
      Staff clicks "Issue"
              ↓
     Certificate created in the Registry
              ↓
  Alumni status granted automatically
              ↓
   Certificate can later be Revoked (reason required)
   — the record itself is always kept, never deleted
```

### Rewards journey

```
Lead was referred by a Growth/Community Partner
              ↓
        Lead is Admitted (becomes a Participant)
              ↓
       A payment is recorded against their fees
              ↓
System checks for an active Reward Rule for that programme
              ↓
        Match found? ──── No ───→ No reward generated
             │ Yes
              ↓
 Reward Ledger entry created automatically ("Accrued")
 + Partner's Wallet balance increased
              ↓
     Partner requests a Payout (full balance)
              ↓
TerraNext Approves → Marks Paid
   (Reward status becomes "Paid")

  If the original payment is later reversed:
  the matching reward is automatically "Clawed back"
  and the wallet balance is reduced again.
```

---

## 49. Troubleshooting Guide

Problems are grouped by topic below so you can jump straight to what's going wrong.

### Cannot Login

| Problem | Likely reason | What to do |
|---|---|---|
| "Invalid email or password" when signing in | Either your email or password is wrong (the message won't say which, for security) | Double-check both carefully, or use "Forgot password?" |
| "Too many failed login attempts" | You've tried the wrong password several times in a row (3/5/10-attempt lockout tiers — Chapter 5) | Wait for the countdown shown on screen, or use "Forgot password?" |
| Screen suddenly shows "Session locked" mid-work | You were inactive for a while — this is automatic protection for certain roles (Chapter 3) | Type your password to unlock; nothing you were doing is lost |
| You can sign in but land on "Not authorized" for every page | Your account exists but has no working role, or was recently disabled | Contact a System Administrator (Chapter 31) |
| A Growth/Community Partner can't sign in at all | Their application is still "Pending approval," or was "Rejected"/"Suspended" | Staff: check their status in Chapter 23/24. Partners: wait for the approval email, or contact TerraNext support |

### Password Reset

| Problem | Likely reason | What to do |
|---|---|---|
| Password reset link says invalid or expired | Links expire after 1 hour and work only once | Request a new one from "Forgot password?" (Chapter 5) |
| No password reset email arrives | Check spam/junk first — for security, the system shows the same "link sent" message whether or not the account actually exists, and repeated requests within 60 seconds are silently ignored | Wait a minute and check spam; if it still never arrives, ask a System Administrator to confirm your email is correct on your account |
| New staff account holder never got their "set your password" email | Email delivery can occasionally fail silently | Ask the System Administrator who created the account — the one-time link is also shown on-screen at creation time (Chapter 31) and may still be available to resend |

### Lead Missing

| Problem | Likely reason | What to do |
|---|---|---|
| A website enquiry doesn't seem to have created a Lead | The Leads list has no search box and is capped at showing the 500 most recently updated leads (Chapter 7) — a genuine lead is very unlikely to be silently dropped, since duplicate phone numbers update the existing record rather than being rejected | Scroll the full list, or check with a System Administrator; also confirm the phone number wasn't already on file under a slightly different enquiry |
| A Transformation Consultant can't find a lead they know exists | Consultants only see leads assigned to them (Chapter 7) | Ask an Operations Manager (who sees every lead) to check and reassign it to you if appropriate |
| A partner-referred lead is missing from "My Leads" in the Partner Portal | The lead was created without a valid, active referral code attached (see "Referral Missing" below) | Confirm with staff whether the applicant actually used your link/QR code, and that your partner account was "Active" (not pending/suspended) at the time |

### QR Not Working

| Problem | Likely reason | What to do |
|---|---|---|
| A partner has no QR code to show yet | QR codes are only generated after staff approve the partner's application (Chapters 23/24/40) | Wait for approval; there is nothing to download before then |
| Scanning the QR code doesn't seem to credit the right partner | An invalid, mistyped, or inactive (suspended/pending) partner code still sends the visitor to the Apply page normally — it simply does not attribute the referral | Confirm the partner's account status is "Active"; a suspended or not-yet-approved partner's code cannot earn credit even though it still redirects |
| A partner can't find where to download their own QR code inside the Partner Portal | Self-service QR download is not surfaced anywhere in the Partner Portal's menus today | Staff can download and share the QR code on the partner's behalf from their profile page (Chapters 23/24) |

### Certificate Not Generated

| Problem | Likely reason | What to do |
|---|---|---|
| A participant isn't showing as eligible for a certificate | Their live attendance % or assessment average is below the programme's required thresholds (Chapter 17) | Check the specific shortfall shown on the Eligibility queue row; an Operations Manager may Override with a written reason if there is a genuine exception |
| The "Issue" button is missing entirely | Only Operations Managers can issue, override, or revoke certificates; Programme Coordinators can view eligibility but not issue | Ask an Operations Manager to complete the issuance |
| A certificate can't be verified by a third party (e.g. an employer) | There is currently no public, user-facing certificate-verification web page in the product, even though a background lookup capability exists | Direct the enquiry to TerraNext staff to confirm the certificate manually until a public verification page is built |

### Email Not Received

| Problem | Likely reason | What to do |
|---|---|---|
| A lead never got their enquiry-acknowledgement email | It's only sent if an email address was provided on the enquiry, and delivery isn't guaranteed | Check spam; confirm an email address was actually captured on the Lead record (Chapter 7) |
| A message logged in Communications shows "Failed" | The recipient had no email/phone on file, or the message provider could not deliver it | Check the Lead/Participant's contact details are correct and complete, then try sending again (Chapter 28) |
| A "Queued" message never seems to move to "Sent" | It hasn't been picked up by the automatic sending process yet | Wait a few minutes and refresh; if it's still "Queued" or moves to "Failed" after a while, check the recipient's contact details |

### Referral Missing

| Problem | Likely reason | What to do |
|---|---|---|
| A partner says they referred someone, but no reward appeared | A reward is only generated once (a) the referred lead is admitted as a participant, and (b) a payment is actually recorded against their fees, and (c) an active reward rule exists for that programme (Chapters 25/26) | Confirm all three conditions with staff; if a payment hasn't been recorded yet, the reward genuinely hasn't been earned yet |
| The referral credit went to the wrong partner, or no partner at all | The visitor may not have used the referral link/QR code at all, or used one for an inactive/pending partner | Referral attribution cannot be changed after the fact through the interface — contact a System Administrator if a genuine correction is needed |
| A reward that had appeared has disappeared or gone negative | The original payment was reversed (Chapter 27), which automatically claws back any reward it generated | This is expected behaviour, not an error — check the Fees module for a matching reversal entry |

### Everything Else

| Problem | Likely reason | What to do |
|---|---|---|
| I can't see a menu item I expect | Your role doesn't have permission for that module | Check Chapter 4; ask a System Administrator if you believe this is wrong |
| A button I need isn't there | Your role has "view" but not "create/update/approve" for that action | Check the "Who should use this module" section of the relevant chapter |
| I created a lead/participant and got a "duplicate" warning | Someone with the same phone number already exists in the system | Review the existing record before proceeding — it may be the same person |
| I can't submit a form | A required field is empty, or a validation rule wasn't met (e.g. a reason needs at least 10 characters) | Read the red error message next to the field — it explains exactly what's needed |
| A number on the Dashboard shows "—" | That figure genuinely cannot be measured yet — it is not the same as zero | Check the relevant module directly for the underlying data |
| A batch or seat won't let me allocate a participant | The batch is full, or no longer accepting allocations | Choose a different batch, or increase capacity if appropriate |
| I can't find attendance/certificates/fees on a participant's profile | These are managed in their own separate modules, not shown on the Participant profile today | Go to Attendance, Certificates, or Fees directly and search for the participant there |
| A file won't upload | It's over 10MB, or not a JPEG/PNG/WebP/PDF | Compress or convert the file, then try again |
| I can't approve my own discount | Deliberate — the person who collects payment cannot approve their own discount | Ask an Operations Manager or Founder |
| I can't reject a partner application or payout with a written reason | Neither reject action currently has a reason field on screen | Communicate the reason to the applicant/partner outside the system if needed |

---

## 50. Frequently Asked Questions

**Q: Do I need any computer training to use this system?**
A: No — every screen is designed to be usable with basic web browsing skills. This manual walks you through every action step by step.

**Q: What happens if I make a mistake?**
A: The system is designed so mistakes are almost always correctable — records are rarely truly deleted (only hidden/archived), payments are corrected with a reversing entry rather than an edit, and everything important is recorded in the Audit Logs so nothing is ever silently lost.

**Q: Who can see what I do in the system?**
A: Every meaningful action you take is recorded with your name, role, and the exact time, visible to Founders and System Administrators in the Audit Logs (Chapter 33).

**Q: Can I use the CRM on my phone?**
A: The CRM works in a regular web browser; screens like Attendance are specifically designed to be fast and comfortable to use on a phone.

**Q: What if two people try to do the same thing at the same time (e.g. the last seat in a batch)?**
A: The system automatically protects against this — only one person's action succeeds, and the other is asked to try again, so nothing is ever double-booked or overwritten silently.

**Q: Is my data safe?**
A: Yes — access is tightly controlled by role, every important action is permanently logged, and destructive actions (like deleting a lead) are hidden rather than truly erased.

**Q: Something described in this manual doesn't match what I see on screen. What do I do?**
A: Please report this to your System Administrator — this manual is written to match the live system exactly, so a mismatch likely means the system has been updated since this manual's date, and the manual should be refreshed.

---

## 51. Operating Checklists

Simple routines to keep the CRM — and the business it runs — healthy. Not every item applies to every role; use the ones relevant to you. Checked items are not saved anywhere in the system; this is a personal or team routine, not a CRM feature.

### 50.1 Daily Checklist

**For Transformation Consultants**
- [ ] Check the Dashboard for today's acquisition numbers
- [ ] Review assigned Leads and log any overdue follow-ups
- [ ] Record any counselling sessions held today
- [ ] Follow up on leads whose "Next follow-up" date is today or has passed

**For Operations Managers**
- [ ] Review the Admissions queue for leads ready to convert
- [ ] Check pending Growth Partner / Community Business approvals
- [ ] Review any discount requests waiting for approval
- [ ] Check the Dashboard's Acquisition and Academic Delivery sections

**For Programme Coordinators**
- [ ] Check the Certificate eligibility queue for anyone newly ready
- [ ] Review batch rosters for upcoming capacity issues
- [ ] Confirm every session held today has attendance marked (Trainers may need a reminder)
- [ ] Check for any new assessments that need to be created for tomorrow

**For Trainers**
- [ ] Mark attendance for every session you held today — before you forget the details
- [ ] Enter any assessment scores from today's tests
- [ ] Review tomorrow's session on your batch's schedule

**For Finance Officers**
- [ ] Review the Pending Fees report
- [ ] Record today's payments and issue receipts
- [ ] Follow up on any overdue installments
- [ ] Review any payment reversal requests

**For Career & Placement Officers**
- [ ] Review new Career Interest profiles awaiting an eligibility decision
- [ ] Check the Placements board for candidates ready to advance
- [ ] Follow up on employer contacts for active placements

**For System Administrators**
- [ ] Review any new staff account requests
- [ ] Spot-check the Audit Logs (especially the "Overrides" view) for anything unusual
- [ ] Confirm no accounts need to be disabled (e.g. departed staff)

**For Founders**
- [ ] Review the full Dashboard across all sections
- [ ] Spot-check Reports for any data-quality warnings (e.g. duplicate-suspect leads, counselling integrity check)
- [ ] Review pending partner approvals and payout requests

### 50.2 Weekly Checklist

**For Operations Managers**
- [ ] Run the "Duplicate-suspect leads" report and merge or resolve any matches (Chapter 29)
- [ ] Run the "Counselling conversion" report and confirm the always-zero integrity check still passes
- [ ] Review the "Batch utilisation" report for batches that need a fresh recruitment push
- [ ] Check the Colleges list for lead-source performance and follow up with under-performing colleges

**For Programme Coordinators**
- [ ] Run the "Attendance risk" report and reach out to anyone below their certification threshold while their batch is still running
- [ ] Review upcoming batches (Planned status) for readiness — trainer assigned, schedule confirmed

**For Finance Officers**
- [ ] Reconcile the week's recorded payments against your bank/UPI statements
- [ ] Review all discount approvals from the week for consistency

**For Founders / System Administrators**
- [ ] Review the Audit Logs' "Data Exports" preset — confirm every export this week had a legitimate business reason
- [ ] Review the Growth Partner and Community Business leaderboards for standout performers worth recognising

### 50.3 Monthly Checklist

**For Founders**
- [ ] Review the full Dashboard month-over-month, not just the current snapshot
- [ ] Run the "Alumni growth" report and review the month's new-alumni trend
- [ ] Run the "Growth Partner rewards" report and review total accrued vs. paid rewards
- [ ] Review Settings (Organisation, Branding, ID Formats, Leadership Levels) for anything due an update

**For Operations Managers**
- [ ] Review every batch's status and archive/close any that have genuinely finished
- [ ] Review the Programmes catalogue for fee plans or certificate thresholds that may need revisiting

**For System Administrators**
- [ ] Review the full Users list for accounts that should be disabled (long-departed staff)
- [ ] Review the Roles & Permissions matrix (Chapter 32) against how the organisation actually operates today

**For Finance Officers**
- [ ] Run the "Growth Partner rewards" report and reconcile against actual payouts made
- [ ] Review outstanding fee balances older than one month for collection follow-up

---

## 52. Best Practices Summary

- **Log everything as you go.** Activity notes, counselling records, and Timeline entries are only useful if they're entered promptly and honestly.
- **Never share your login.** Every action is tied to the person actually signed in — sharing logins breaks the audit trail that protects everyone.
- **Trust the permission system.** If you can't see or do something, it's almost always by design — ask, don't work around it.
- **Write clear reasons for exceptions.** Overrides, discount approvals, reversals, and revocations all require a written reason — make it specific enough that someone reading it in a year would understand exactly why.
- **Use "Forgot password?" instead of guessing.** Repeated wrong password attempts lock your account temporarily.
- **Double-check before irreversible actions.** Converting a lead to a participant issues a permanent ID that can never be reissued — always verify details carefully first.
- **Report mismatches.** If this manual or the system behaves unexpectedly, tell your System Administrator rather than guessing or working around it.

---

## 53. Support Contact

For any question not answered in this manual, or if something in the system does not behave as described here, please contact:

| Type of issue | Who to contact |
|---|---|
| Forgotten password, account access | Use "Forgot password?" first; if that fails, contact your System Administrator |
| New staff account needed | Your System Administrator or Founder |
| Permission/role questions | Your System Administrator |
| A screen doesn't match this manual, or something looks broken | Your System Administrator (technical team) |
| Growth Partner / Community Business application status | TerraNext support (as advised on the public website) |
| General business questions | Your manager / Operations Manager |

**Internal Support Contact:** _[To be filled in — System Administrator name / email / phone]_
**Growth Partner Support Contact:** _[To be filled in — public support email / phone]_

---

## Glossary

Plain-English definitions of every system-specific term used in this manual, in alphabetical order.

**Academy** — A broad subject grouping that contains one or more Programmes (e.g. "NextGen Transformation Academy"). Managed in Chapter 13.

**Admission / Admitted** — The act of converting a qualifying Lead into a permanent Participant record (Chapter 9). Also a Lead pipeline stage.

**Alumni** — A former participant who has earned at least one certificate. Alumni status is granted automatically at the moment of certificate issuance (Chapter 21).

**Application Notes** — A free-text field on a Growth Partner or Community Business application that consolidates several public-registration-form fields (like preferred location or areas of interest) that do not have their own separate field inside the CRM (Chapters 23, 44).

**Assessment** — A graded test tied to one Batch, used to calculate whether a participant qualifies for a certificate (Chapter 16).

**Attendance** — A per-session record of whether each participant was Present, Absent, Late, or Excused (Chapter 15).

**Audit Log** — A permanent, unchangeable record of every meaningful action taken in the CRM: who did it, when, and what changed (Chapter 33).

**Batch** — A specific running instance of a Programme: a group of participants, a trainer, a schedule, and a date range (Chapter 14).

**BR- (Business Rule)** — An internal reference code (e.g. "BR-02") the system uses in its own documentation to name a specific business rule, such as "no admission without a recommending counselling session." You may occasionally see these codes referenced in on-screen explanations.

**Career Interest** — A profile capturing a participant's job/country preferences and a staff decision on whether they are ready for the Placements pipeline (Chapter 18).

**Certificate** — A formal record that a participant has completed a Programme and met its attendance/assessment requirements, issued from the Certificates module (Chapter 17).

**Community Business / Community Partner / Growth Community Business** — A business (gym, café, tuition centre, etc.) that refers people to TerraNext and earns rewards, distinct from an individual Growth Partner (Chapters 24, 45).

**Consent** — A required confirmation that a person has agreed to be contacted; cannot be skipped when creating a Lead.

**Dashboard** — The role-scoped homepage showing live summary numbers (Chapter 6).

**Enrolment** — One instance of a Participant being enrolled in a specific Programme; a participant can have more than one enrolment over their lifetime (Chapter 12).

**Fee Account** — The financial record for one enrolment: total fee, discounts, payments, and balance (Chapter 27).

**Growth Partner** — An individual (not a business) who refers people to TerraNext and earns rewards (Chapter 23).

**Human Partner ID** — The permanent, readable ID given to an approved partner (e.g. `TGP-000001` for a Growth Partner, `TCGN-000001` for a Community Business), minted only at approval.

**Leadership Level** — An organisation-defined recognition tier for Growth Partners (not a fixed universal scale), configured in Settings (Chapters 23, 34).

**Lead** — Any enquiry about TerraNext, from any source, before it becomes a Participant (Chapter 7).

**NextStep** — TerraNext's name for post-certification alumni mentorship; currently exists only as an unused flag with no working screen (Chapter 22). Also, unrelatedly, the name of one option in the public Apply form's Academy list.

**Participant** — The permanent, lifetime record created when a Lead is admitted; one person, one record, forever (Chapter 12).

**Participant ID** — The unique, permanent identifier issued to a Participant at admission (format `TNX-YYYY-NNNNN` by default), never reissued or reused.

**Payout** — A partner's request to be paid their earned reward wallet balance in full (Chapter 26).

**Pipeline Stage** — The current step a Lead is at (New, Contacted, Counselling booked, and so on — Chapter 7).

**Placement** — A specific attempt to place an eligible participant with an Employer, tracked through a pipeline (Chapter 19).

**Programme** — A specific course offered under an Academy, with its own fee, certificate rules, and duration (Chapter 13).

**QR Code / Referral Link** — The scannable code or web link, unique to each approved partner, used to credit a referral automatically (Chapter 46).

**Receipt Number** — The auto-generated identifier for a recorded fee payment (format `RCP-FYnn-NNNNN` by default), resetting each financial year.

**Referral Code** — The short code (part of a QR/referral link) that credits a Lead's origin to a specific partner.

**Resend Access Email** — A staff action, available once a partner is Active, that sends the partner a fresh secure "set your password" link — for example if their original welcome email was lost or never arrived. It never creates a duplicate account and never sends a plain-text password (Chapters 23, 24).

**Reversal (Payment)** — A correcting entry that offsets an incorrect payment without editing or deleting the original (Chapter 27).

**Reward** — An automatic credit to a partner's wallet, generated when a payment is recorded for a participant they referred, if a matching Reward Rule is active (Chapters 25, 27).

**Reward Rule** — A configured amount (flat or percentage) defining how much a partner earns per successful referral payment, per programme (Chapter 25).

**Role** — The single label (e.g. "Trainer," "Founder") that determines exactly what a staff member can see and do (Chapter 4).

**Soft Delete** — Hiding a record from active lists without permanently destroying it; used everywhere instead of true deletion.

**Wallet Balance** — A partner's current, unpaid reward total, available to request as a Payout.

---

## Index

An alphabetical guide to where each topic is covered.

**A** — Academies (13, 33), Admissions (9), Alumni (21), Application Pop-up (43), Apply Form (42), Assessments (16), Attendance (15), Audit Logs (33)

**B** — Batches (14), Best Practices (52), Branding Settings (34)

**C** — Career Interest (18), Certificates (17), Checklists (51), Colleges (11), Communications (28), Community Business / Community Partners (24, 45), Consent (7), Contact Form (43), Counselling (8)

**D** — Dashboard (6), Discounts (27), Duplicate Detection (7, 9, 44)

**E** — Employers (20), Enrolments (12)

**F** — FAQs (50), Fees & Collections (27), Forgot Password (5)

**G** — Glossary (this back matter), Growth Community Business (24, 45), Growth Partners (23, 44)

**I** — ID Formats (34), Index (this back matter)

**L** — Leadership Levels (23, 33), Leads (7), Lockout / Login Security (5)

**N** — NextStep (22), Notifications, Partner (39), Notifications, Staff (30)

**P** — Parents & Families (10), Participants (12), Password Reset (5), Payouts (26), Placements (19), Programmes (13)

**Q** — QR Codes (23, 24, 41, 46), Quick Start Guide (front matter)

**R** — Referral Links (46), Reports (29), Resend Access Email (23, 24), Reward Rules (25), Rewards (25, 27, 38), Roles & Permissions (4, 32)

**S** — Session Locking (3), Settings (34), Signing In (5), Support Contact (53)

**T** — Troubleshooting (49)

**U** — Users (31)

**W** — Website & CRM Integration (47), Workflow Diagrams (48)

---

*End of Manual. TerraNext Business OS — User Manual, Version 1.2, 11 August 2026.*

