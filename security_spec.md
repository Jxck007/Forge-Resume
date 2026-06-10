# Firestore Security Policy Specification (ResumeForge AI)

## 1. Data Invariants
- A User profile document (/users/{userId}) can only be read, created, updated, or modified by the authenticated user whose `request.auth.uid` matches `{userId}`.
- For all writes to the `users` collection, `groqApiKey` and other fields must be properly bounded in size. Users cannot set themselves or others as admins since there's no admin concepts requested, or any admin rules are disabled.
- A Resume document (/resumes/{resumeId}) can only be accessed (read/write/delete/create) if the authenticated user's ID matches the resume's `userId` field: `resource.data.userId == request.auth.uid`.
- An ATS Report document (/atsReports/{reportId}) must belong to the user who ran the ATS check: `resource.data.userId == request.auth.uid`.

## 2. The "Dirty Dozen" Payloads (Malicious attempts to bypass policies)
1. **Identity Spoofing on User Profile Creation**: Creating a profile for a different UID.
2. **Key Injection into User Profile**: Injecting arbitrary extra fields into the profile.
3. **Malicious Resume Creation (Foreign Owner)**: Attempting to write a resume where the `userId` is another developer's UID.
4. **Anomalous Resume State / Injection of massive size fields**: Forcing a 2MB summary to trigger Denial of Wallet.
5. **Resume Hijacking (Unauthorized Edit)**: Trying to update another user's resume.
6. **Owner Field Corruption**: Modifying the `userId` of a resume during update to transfer ownership.
7. **ATS Report Hijact**: Accessing or creating an ATS report belonging to another user.
8. **Malicious ATS Report Creation with Fraudulent Date**: Creation of report with client-controlled future timestamp.
9. **Bypassing Verification**: Writing rules while being unverified if verified required (or signing in with an unverified account which we'll secure).
10. **Query Scraping Resumes**: Attempting a query-all on resumes with no ownership filters.
11. **Shadow Update Gate bypass**: Attempting to alter a resume's template to a weird unapproved string.
12. **Null/Undefined Timestamp Fraud**: Setting `createdAt` of a resume to a string instead of a valid Server Timestamp.

## 3. Security Rules draft (`DRAFT_firestore.rules`)
We will enforce this directly in the `firestore.rules` file below.
To comply with ESLint security rules, let's write accurate firestore.rules.
